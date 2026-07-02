import { Component, PureComponent, createContext, createElement, memo, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createPortal } from "react-dom";
//#region src/audio-player/core/audio/audioCaches.ts
/** Shared decoded-buffer LRU cache for Web Audio playback. */
var LRUAudioCache = class {
	maxSize;
	cache = /* @__PURE__ */ new Map();
	order = [];
	constructor(maxSize = 12) {
		this.maxSize = maxSize;
	}
	getStats() {
		let size = 0;
		for (const buffer of this.cache.values()) size += buffer.length * buffer.numberOfChannels * 4;
		return {
			decodedBufferCount: this.cache.size,
			decodedBufferBytes: size,
			lruOrder: [...this.order]
		};
	}
	setMaxSize(size) {
		this.maxSize = size;
		this.enforceSize();
	}
	prune(keepKeys, keepRecent = 0) {
		const toKeep = new Set(keepKeys);
		let recentKept = 0;
		for (let i = this.order.length - 1; i >= 0; i--) {
			const key = this.order[i];
			if (toKeep.has(key)) continue;
			if (recentKept < keepRecent) {
				recentKept++;
				continue;
			}
			this.cache.delete(key);
			this.order.splice(i, 1);
		}
	}
	enforceSize() {
		while (this.cache.size > this.maxSize && this.order.length > 0) {
			const oldestKey = this.order.shift();
			this.cache.delete(oldestKey);
		}
	}
	get(url) {
		const buffer = this.cache.get(url);
		if (!buffer) return null;
		const index = this.order.indexOf(url);
		if (index > -1) this.order.splice(index, 1);
		this.order.push(url);
		return buffer;
	}
	set(url, buffer) {
		if (this.cache.has(url)) {
			this.cache.delete(url);
			const index = this.order.indexOf(url);
			if (index > -1) this.order.splice(index, 1);
		}
		this.order.push(url);
		this.cache.set(url, buffer);
		this.enforceSize();
	}
	has(url) {
		return this.cache.has(url);
	}
	delete(url) {
		this.cache.delete(url);
		const index = this.order.indexOf(url);
		if (index > -1) this.order.splice(index, 1);
	}
	clear() {
		this.cache.clear();
		this.order = [];
	}
};
function getMimeType(url) {
	const pathname = url.split("?")[0]?.toLowerCase() ?? "";
	if (pathname.endsWith(".wav")) return "audio/wav";
	if (pathname.endsWith(".ogg") || pathname.endsWith(".oga")) return "audio/ogg";
	if (pathname.endsWith(".m4a") || pathname.endsWith(".mp4")) return "audio/mp4";
	if (pathname.endsWith(".aac")) return "audio/aac";
	if (pathname.endsWith(".flac")) return "audio/flac";
	if (pathname.endsWith(".webm")) return "audio/webm";
	return "audio/mpeg";
}
/** Persistent raw audio cache backed by the browser Cache API. */
var PersistentAudioCache = class {
	cacheName = "seihouse-audio-vault-v1";
	get isAvailable() {
		return typeof caches !== "undefined" && typeof Response !== "undefined";
	}
	async getArrayBuffer(url) {
		if (!this.isAvailable) return null;
		try {
			const response = await (await caches.open(this.cacheName)).match(url);
			return response ? await response.arrayBuffer() : null;
		} catch {
			return null;
		}
	}
	async putArrayBuffer(url, buffer) {
		if (!this.isAvailable) return;
		try {
			const cache = await caches.open(this.cacheName);
			const response = new Response(buffer.slice(0), { headers: {
				"Content-Type": getMimeType(url),
				"Content-Length": buffer.byteLength.toString()
			} });
			await cache.put(url, response);
		} catch (error) {
			console.warn("Persistent cache full or unavailable, skipping disk write.", error);
		}
	}
};
/** Pool of detached HTMLAudioElements for passive preload / streaming fallbacks. */
var HTML5AudioPool = class {
	maxSize;
	pool = [];
	constructor(maxSize = 5) {
		this.maxSize = maxSize;
	}
	getStats() {
		return { preloadElementCount: this.pool.length };
	}
	acquire() {
		let audio = this.pool.find((candidate) => candidate.paused && !candidate.ended);
		if (!audio && this.pool.length < this.maxSize) {
			audio = new Audio();
			audio.preload = "auto";
			this.pool.push(audio);
		} else if (!audio) {
			audio = this.pool[0];
			audio.pause();
		}
		return audio;
	}
	release(audio) {
		audio.pause();
		audio.removeAttribute("src");
		audio.src = "";
		audio.load();
	}
	releaseAll() {
		for (const audio of this.pool) this.release(audio);
	}
};
var sharedAudioBufferCache = new LRUAudioCache();
var sharedAudioStorageCache = new PersistentAudioCache();
var sharedHTML5AudioPool = new HTML5AudioPool();
//#endregion
//#region src/audio-player/core/audio/HTML5AudioBackend.ts
var HTML5_CAPABILITIES = {
	streaming: true,
	preciseTiming: false,
	reliableVolume: false,
	decodeAhead: false,
	requiresCors: false,
	progressiveBuffered: true
};
/**
* Thin pass-through over the host-rendered `<audio>` element. Every call reads
* `audioRef.current` at invocation time and forwards 1:1, so behavior is
* identical to the hook touching the element directly. When the ref has not
* mounted, methods no-op / return the same defaults the hook's old
* `if (!audio) return` guards produced.
*/
var HTML5AudioBackend = class {
	kind = "html5";
	audioRef;
	preloadAudio = null;
	info;
	constructor(audioRef, info) {
		this.audioRef = audioRef;
		this.info = info ?? {
			requested: "html5",
			active: "html5",
			didFallback: false,
			capabilities: HTML5_CAPABILITIES
		};
	}
	get audio() {
		return this.audioRef.current;
	}
	isAttached() {
		return this.audio !== null;
	}
	setSource(_src) {}
	load() {
		this.audio?.load();
	}
	clearSource() {
		const audio = this.audio;
		if (!audio) return;
		audio.removeAttribute("src");
		audio.load();
	}
	play() {
		const audio = this.audio;
		if (!audio) {
			const error = /* @__PURE__ */ new Error("Audio element is not mounted.");
			error.name = "NotSupportedError";
			return Promise.reject(error);
		}
		return audio.play();
	}
	pause() {
		this.audio?.pause();
	}
	getCurrentTime() {
		return this.audio?.currentTime ?? 0;
	}
	setCurrentTime(seconds) {
		const audio = this.audio;
		if (audio) audio.currentTime = seconds;
	}
	getDuration() {
		return this.audio?.duration ?? 0;
	}
	isPaused() {
		return this.audio?.paused ?? true;
	}
	isEnded() {
		return this.audio?.ended ?? false;
	}
	hasMetadata() {
		return (this.audio?.readyState ?? 0) >= 1;
	}
	setVolume(value) {
		const audio = this.audio;
		if (audio) audio.volume = value;
	}
	getVolume() {
		return this.audio?.volume ?? 1;
	}
	isMuted() {
		return this.audio?.muted ?? false;
	}
	setMuted(muted) {
		const audio = this.audio;
		if (audio) audio.muted = muted;
	}
	setLoop(loop) {
		const audio = this.audio;
		if (audio) audio.loop = loop;
	}
	getBufferedRanges() {
		const audio = this.audio;
		if (!audio) return [];
		const ranges = [];
		const length = audio.buffered.length;
		for (let i = 0; i < length; i++) ranges.push({
			start: audio.buffered.start(i),
			end: audio.buffered.end(i)
		});
		return ranges;
	}
	getError() {
		const error = this.audio?.error;
		if (!error) return null;
		switch (error.code) {
			case error.MEDIA_ERR_ABORTED: return "aborted";
			case error.MEDIA_ERR_NETWORK: return "network";
			case error.MEDIA_ERR_DECODE: return "decode";
			case error.MEDIA_ERR_SRC_NOT_SUPPORTED: return "src-not-supported";
			default: return "unknown";
		}
	}
	getDecodedData() {
		return null;
	}
	addEventListener(event, handler) {
		this.audio?.addEventListener(event, handler);
	}
	removeEventListener(event, handler) {
		this.audio?.removeEventListener(event, handler);
	}
	preload(url) {
		let el = this.preloadAudio;
		if (!el) {
			el = sharedHTML5AudioPool.acquire();
			el.preload = "auto";
			this.preloadAudio = el;
		}
		if (el.src !== url) {
			el.src = url;
			el.load();
		}
	}
	releasePreload() {
		if (this.preloadAudio) {
			sharedHTML5AudioPool.release(this.preloadAudio);
			this.preloadAudio = null;
		}
	}
	getMediaElement() {
		return this.audio;
	}
	getInfo() {
		return this.info;
	}
	destroy() {
		this.releasePreload();
	}
	supportsSpatial() {
		return false;
	}
	setStereo(_pan) {
		console.warn("[HTML5AudioBackend] setStereo() called but spatial audio is not supported. Use webaudio backend for spatial features.");
	}
	getStereo() {
		return 0;
	}
	setPos(_x, _y, _z) {
		console.warn("[HTML5AudioBackend] setPos() called but spatial audio is not supported. Use webaudio backend for spatial features.");
	}
	getPos() {
		return [
			0,
			0,
			0
		];
	}
	setOrientation(_x, _y, _z) {
		console.warn("[HTML5AudioBackend] setOrientation() called but spatial audio is not supported.");
	}
	getOrientation() {
		return [
			1,
			0,
			0
		];
	}
	setRate(_rate) {
		console.warn("[HTML5AudioBackend] setRate() called but rate control is not supported. Use webaudio backend for rate control.");
	}
	getRate() {
		return 1;
	}
	setDistanceModel(_model) {
		console.warn("[HTML5AudioBackend] setDistanceModel() called but spatial audio is not supported.");
	}
	getDistanceModel() {
		return "inverse";
	}
	setRefDistance(_distance) {
		console.warn("[HTML5AudioBackend] setRefDistance() called but spatial audio is not supported.");
	}
	getRefDistance() {
		return 1;
	}
	setMaxDistance(_distance) {
		console.warn("[HTML5AudioBackend] setMaxDistance() called but spatial audio is not supported.");
	}
	getMaxDistance() {
		return 1e4;
	}
	setRolloffFactor(_factor) {
		console.warn("[HTML5AudioBackend] setRolloffFactor() called but spatial audio is not supported.");
	}
	getRolloffFactor() {
		return 1;
	}
	setConeInnerAngle(_angle) {
		console.warn("[HTML5AudioBackend] setConeInnerAngle() called but spatial audio is not supported.");
	}
	getConeInnerAngle() {
		return 360;
	}
	setConeOuterAngle(_angle) {
		console.warn("[HTML5AudioBackend] setConeOuterAngle() called but spatial audio is not supported.");
	}
	getConeOuterAngle() {
		return 360;
	}
	setConeOuterGain(_gain) {
		console.warn("[HTML5AudioBackend] setConeOuterGain() called but spatial audio is not supported.");
	}
	getConeOuterGain() {
		return 0;
	}
	setLiteMode(_enabled) {}
	isLiteMode() {
		return true;
	}
};
//#endregion
//#region src/audio-player/core/audio/WebAudioBackend.ts
var WEBAUDIO_CAPABILITIES = {
	streaming: false,
	preciseTiming: true,
	reliableVolume: true,
	decodeAhead: true,
	requiresCors: true,
	progressiveBuffered: false
};
/** Default spatial audio values matching Howler.js conventions. */
var DEFAULT_SPATIAL = {
	stereo: 0,
	pos: [
		0,
		0,
		0
	],
	orientation: [
		1,
		0,
		0
	],
	rate: 1,
	distanceModel: "inverse",
	refDistance: 1,
	maxDistance: 1e4,
	rolloffFactor: 1,
	coneInnerAngle: 360,
	coneOuterAngle: 360,
	coneOuterGain: 0,
	liteMode: false
};
function namedError(name, message) {
	const error = new Error(message);
	error.name = name;
	return error;
}
function getAudioContextCtor$1() {
	if (typeof window === "undefined") return void 0;
	return window.AudioContext ?? window.webkitAudioContext;
}
/**
* One AudioContext shared by every WebAudioBackend instance on the page.
* Browsers cap (and charge resources for) concurrent contexts, so each
* backend gets its own GainNode into the shared context instead. Reference
* counted: closed when the last backend releases it, recreated on demand.
*/
var sharedContext = null;
var sharedContextUsers = 0;
function retainSharedContext() {
	if (!sharedContext || sharedContext.state === "closed") {
		const Ctor = getAudioContextCtor$1();
		if (!Ctor) throw namedError("NotSupportedError", "Web Audio API unavailable.");
		sharedContext = new Ctor();
		sharedContextUsers = 0;
	}
	sharedContextUsers += 1;
	return sharedContext;
}
function releaseSharedContext(ctx) {
	if (ctx !== sharedContext) return;
	sharedContextUsers = Math.max(0, sharedContextUsers - 1);
	if (sharedContextUsers === 0) {
		if (sharedContext.state !== "closed") sharedContext.close().catch(() => {});
		sharedContext = null;
	}
}
/**
* Web Audio playback backend: fetch + decodeAudioData into an AudioBuffer,
* played through AudioBufferSourceNode → [PannerNode] → StereoPannerNode → GainNode → destination.
*
* Spatial audio features (Howler.js-style API):
* - Stereo panning via StereoPannerNode (-1 left to 1 right)
* - 3D positioning via PannerNode with HRTF (default) or equalpower (lite mode)
* - Source orientation for directional audio
* - Distance modeling (inverse/linear/exponential) with refDistance, maxDistance, rolloffFactor
* - Cone settings for directional audio (coneInnerAngle, coneOuterAngle, coneOuterGain)
* - Playback rate control (0.5 to 4.0)
* - Lite mode: skips 3D PannerNode, uses only StereoPannerNode for mobile/low-power
*
* Synthesizes the media-element events the engine hook expects, so the hook's
* state machine is identical to the html5 path. Key semantic mappings:
* - pause = stop the source node and remember the offset (not ctx.suspend(),
*   which is context-global and would ambiguate the autoplay check).
* - seek while playing = silently swap in a new source node at the offset.
* - native loop = `source.loop`, which (like the html5 `loop` attribute)
*   suppresses the `ended` event — repeat-one relies on that.
* - volume = GainNode, so programmatic volume works on iOS Safari.
*
* A monotonic `generation` invalidates every in-flight fetch/decode/play when
* the source changes — the backend-level mirror of the hook's playbackToken.
*/
var WebAudioBackend = class {
	kind = "webaudio";
	info;
	ctx = null;
	gain = null;
	panner = null;
	stereoPanner = null;
	source = null;
	buffer = null;
	srcUrl = null;
	state = "idle";
	/** Playback position while not playing; start offset while playing. */
	offset = 0;
	startedAtCtxTime = 0;
	volume = 1;
	muted = false;
	loopFlag = false;
	lastError = null;
	generation = 0;
	/** Invalidates `source.onended` from nodes we stopped on purpose. */
	sourceToken = 0;
	loadPromise = null;
	fetchAbort = null;
	preloadAborts = /* @__PURE__ */ new Map();
	/** In-flight preload decodes, so load() can adopt them instead of re-fetching. */
	preloadPromises = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Map();
	stereoPan = DEFAULT_SPATIAL.stereo;
	position = [...DEFAULT_SPATIAL.pos];
	orientation = [...DEFAULT_SPATIAL.orientation];
	rate = DEFAULT_SPATIAL.rate;
	distanceModel = DEFAULT_SPATIAL.distanceModel;
	refDistance = DEFAULT_SPATIAL.refDistance;
	maxDistance = DEFAULT_SPATIAL.maxDistance;
	rolloffFactor = DEFAULT_SPATIAL.rolloffFactor;
	coneInnerAngle = DEFAULT_SPATIAL.coneInnerAngle;
	coneOuterAngle = DEFAULT_SPATIAL.coneOuterAngle;
	coneOuterGain = DEFAULT_SPATIAL.coneOuterGain;
	liteMode = DEFAULT_SPATIAL.liteMode;
	constructor(info) {
		this.info = info;
	}
	emit(event) {
		const handlers = this.listeners.get(event);
		if (!handlers) return;
		for (const handler of Array.from(handlers)) handler();
	}
	ensureContext() {
		if (this.ctx && this.ctx.state !== "closed") return this.ctx;
		this.ctx = retainSharedContext();
		this.panner = this.ctx.createPanner();
		this.panner.panningModel = this.liteMode ? "equalpower" : "HRTF";
		this.panner.distanceModel = this.distanceModel;
		this.panner.refDistance = this.refDistance;
		this.panner.maxDistance = this.maxDistance;
		this.panner.rolloffFactor = this.rolloffFactor;
		this.panner.coneInnerAngle = this.coneInnerAngle;
		this.panner.coneOuterAngle = this.coneOuterAngle;
		this.panner.coneOuterGain = this.coneOuterGain;
		this.panner.positionX.value = this.position[0];
		this.panner.positionY.value = this.position[1];
		this.panner.positionZ.value = this.position[2];
		this.panner.orientationX.value = this.orientation[0];
		this.panner.orientationY.value = this.orientation[1];
		this.panner.orientationZ.value = this.orientation[2];
		this.gain = this.ctx.createGain();
		this.gain.gain.value = this.muted ? 0 : this.volume;
		if (typeof this.ctx.createStereoPanner === "function") {
			this.stereoPanner = this.ctx.createStereoPanner();
			this.stereoPanner.pan.value = this.stereoPan;
			this.panner.connect(this.stereoPanner);
			this.stereoPanner.connect(this.gain);
		} else this.panner.connect(this.gain);
		this.gain.connect(this.ctx.destination);
		return this.ctx;
	}
	cachePut(url, buffer) {
		sharedAudioBufferCache.set(url, buffer);
	}
	cacheTouch(url) {
		return sharedAudioBufferCache.get(url);
	}
	/** Stop the current source node without emitting any events. */
	stopSourceNode() {
		this.sourceToken += 1;
		const source = this.source;
		if (!source) return;
		this.source = null;
		source.onended = null;
		try {
			source.stop();
		} catch {}
		try {
			source.disconnect();
		} catch {}
	}
	abortFetch() {
		if (this.fetchAbort) {
			this.fetchAbort.abort();
			this.fetchAbort = null;
		}
	}
	failLoad(code, url) {
		this.buffer = null;
		this.lastError = code;
		this.state = "error";
		sharedAudioBufferCache.delete(url);
		this.emit("error");
	}
	async decodeArrayBuffer(data, url, gen, reportErrors = true) {
		try {
			const buffer = await this.ensureContext().decodeAudioData(data.slice(0));
			if (gen !== this.generation) return null;
			this.cachePut(url, buffer);
			return buffer;
		} catch {
			if (gen !== this.generation) return null;
			if (reportErrors) this.failLoad("decode", url);
			return null;
		}
	}
	async fetchNetworkArrayBuffer(url, gen, reportErrors = true, signal) {
		const abort = signal ? null : new AbortController();
		const fetchSignal = signal ?? abort?.signal;
		if (abort) this.fetchAbort = abort;
		try {
			const response = await fetch(url, {
				mode: "cors",
				signal: fetchSignal
			});
			if (gen !== this.generation || fetchSignal?.aborted) return null;
			if (!response.ok) {
				if (reportErrors) this.failLoad("src-not-supported", url);
				return null;
			}
			const data = await response.arrayBuffer();
			if (gen !== this.generation || fetchSignal?.aborted) return null;
			return data;
		} catch (error) {
			if (gen !== this.generation) return null;
			if (error instanceof Error && error.name === "AbortError") return null;
			if (reportErrors) this.failLoad("network", url);
			return null;
		} finally {
			if (abort && this.fetchAbort === abort) this.fetchAbort = null;
		}
	}
	async loadBufferWaterfall(url, gen, reportErrors = true, signal) {
		const memoryHit = this.cacheTouch(url);
		if (memoryHit) return memoryHit;
		const diskHit = await sharedAudioStorageCache.getArrayBuffer(url);
		if (gen !== this.generation || signal?.aborted) return null;
		if (diskHit) return this.decodeArrayBuffer(diskHit, url, gen, reportErrors);
		const networkData = await this.fetchNetworkArrayBuffer(url, gen, reportErrors, signal);
		if (!networkData || gen !== this.generation || signal?.aborted) return null;
		const buffer = await this.decodeArrayBuffer(networkData, url, gen, reportErrors);
		if (buffer) sharedAudioStorageCache.putArrayBuffer(url, networkData);
		return buffer;
	}
	async fetchAndDecode(url, gen) {
		const buffer = await this.loadBufferWaterfall(url, gen);
		if (buffer && gen === this.generation) this.completeLoad(url, buffer);
	}
	/** Adopt a decoded buffer as the active source and announce readiness. */
	completeLoad(url, buffer) {
		this.buffer = buffer;
		this.cachePut(url, buffer);
		this.state = "ready";
		this.emit("loadedmetadata");
		this.emit("progress");
		this.emit("canplay");
		this.emit("canplaythrough");
	}
	/**
	* Wait for an in-flight preload of the same URL instead of starting a
	* second fetch+decode. Falls back to a real load when the preload failed
	* or was aborted, so errors surface through the normal path.
	*/
	async adoptPreload(url, pending, gen) {
		const buffer = await pending;
		if (gen !== this.generation) return;
		if (buffer) {
			this.completeLoad(url, buffer);
			return;
		}
		await this.fetchAndDecode(url, gen);
	}
	/** Start (or restart) playback of the decoded buffer at `offset` seconds. */
	startSource(offset) {
		const ctx = this.ensureContext();
		const buffer = this.buffer;
		if (!buffer || !this.gain) return;
		this.stopSourceNode();
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = this.loopFlag;
		source.connect(this.panner);
		const token = this.sourceToken += 1;
		source.onended = () => {
			if (token !== this.sourceToken) return;
			this.source = null;
			this.offset = buffer.duration;
			this.state = "ended";
			this.emit("ended");
		};
		const clamped = Math.max(0, Math.min(offset, buffer.duration));
		source.start(0, clamped);
		this.source = source;
		this.offset = clamped;
		this.startedAtCtxTime = ctx.currentTime;
		this.state = "playing";
	}
	async playInternal() {
		if (!this.srcUrl) throw namedError("NotSupportedError", "No audio source set.");
		const ctx = this.ensureContext();
		if (!this.buffer && this.state !== "loading") this.load();
		const gen = this.generation;
		let resumed = false;
		try {
			await ctx.resume();
			resumed = true;
		} catch {
			resumed = false;
		}
		if (!resumed || ctx.state !== "running") throw namedError("NotAllowedError", "AudioContext requires a user gesture to start.");
		if (gen !== this.generation) throw namedError("AbortError", "Source changed during play().");
		if (!this.buffer) {
			this.emit("waiting");
			await this.loadPromise;
			if (gen !== this.generation) throw namedError("AbortError", "Source changed during play().");
			if (!this.buffer) throw namedError("NotSupportedError", "Audio failed to load or decode.");
		}
		if (this.state === "playing") return;
		const duration = this.buffer.duration;
		const startAt = this.state === "ended" || this.offset >= duration ? 0 : this.offset;
		this.startSource(startAt);
		this.emit("play");
		this.emit("playing");
	}
	isAttached() {
		return true;
	}
	setSource(src) {
		const next = src && src.trim().length > 0 ? src.trim() : null;
		this.generation += 1;
		this.abortFetch();
		this.stopSourceNode();
		this.srcUrl = next;
		this.buffer = null;
		this.offset = 0;
		this.lastError = null;
		this.loadPromise = null;
		this.state = "idle";
	}
	load() {
		this.generation += 1;
		const gen = this.generation;
		this.abortFetch();
		this.stopSourceNode();
		this.buffer = null;
		this.offset = 0;
		this.lastError = null;
		this.emit("loadstart");
		const url = this.srcUrl;
		if (!url) {
			this.state = "idle";
			this.loadPromise = null;
			return;
		}
		const cached = this.cacheTouch(url);
		if (cached) {
			this.completeLoad(url, cached);
			this.loadPromise = Promise.resolve();
			return;
		}
		this.state = "loading";
		const pending = this.preloadPromises.get(url);
		this.loadPromise = pending ? this.adoptPreload(url, pending, gen) : this.fetchAndDecode(url, gen);
	}
	clearSource() {
		this.setSource(null);
	}
	play() {
		return this.playInternal();
	}
	pause() {
		if (this.state !== "playing") return;
		this.offset = this.getCurrentTime();
		this.stopSourceNode();
		this.state = "paused";
		this.emit("pause");
	}
	getCurrentTime() {
		const duration = this.buffer?.duration ?? 0;
		if (this.state === "playing" && this.ctx) {
			const elapsed = this.ctx.currentTime - this.startedAtCtxTime;
			const position = this.offset + elapsed;
			if (this.loopFlag && duration > 0) return position % duration;
			return Math.min(position, duration);
		}
		return this.offset;
	}
	setCurrentTime(seconds) {
		const duration = this.buffer?.duration ?? 0;
		if (duration <= 0) {
			this.offset = Math.max(0, seconds);
			return;
		}
		const clamped = Math.max(0, Math.min(duration, seconds));
		if (this.state === "playing") {
			this.startSource(clamped);
			return;
		}
		this.offset = clamped;
		if (this.state === "ended" && clamped < duration) this.state = "paused";
		this.emit("timeupdate");
	}
	getDuration() {
		return this.buffer?.duration ?? 0;
	}
	isPaused() {
		return this.state !== "playing";
	}
	isEnded() {
		return this.state === "ended";
	}
	hasMetadata() {
		return this.buffer !== null;
	}
	setVolume(value) {
		this.volume = Math.max(0, Math.min(1, value));
		if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
	}
	getVolume() {
		return this.volume;
	}
	isMuted() {
		return this.muted;
	}
	setMuted(muted) {
		this.muted = muted;
		if (this.gain) this.gain.gain.value = muted ? 0 : this.volume;
	}
	setLoop(loop) {
		if (loop === this.loopFlag) return;
		if (this.state === "playing" && this.ctx) {
			this.offset = this.getCurrentTime();
			this.startedAtCtxTime = this.ctx.currentTime;
		}
		this.loopFlag = loop;
		if (this.source) this.source.loop = loop;
	}
	getBufferedRanges() {
		const duration = this.buffer?.duration ?? 0;
		if (duration <= 0) return [];
		return [{
			start: 0,
			end: duration
		}];
	}
	getError() {
		return this.lastError;
	}
	getDecodedData() {
		return this.buffer;
	}
	addEventListener(event, handler) {
		let handlers = this.listeners.get(event);
		if (!handlers) {
			handlers = /* @__PURE__ */ new Set();
			this.listeners.set(event, handlers);
		}
		handlers.add(handler);
	}
	removeEventListener(event, handler) {
		this.listeners.get(event)?.delete(handler);
	}
	preload(url) {
		const trimmed = url.trim();
		if (!trimmed) return;
		if (sharedAudioBufferCache.has(trimmed) || this.preloadPromises.has(trimmed)) return;
		const abort = new AbortController();
		this.preloadAborts.set(trimmed, abort);
		const run = async () => {
			try {
				const buffer = await this.loadBufferWaterfall(trimmed, this.generation, false, abort.signal);
				if (abort.signal.aborted) return null;
				return buffer;
			} catch {
				return null;
			} finally {
				if (this.preloadAborts.get(trimmed) === abort) this.preloadAborts.delete(trimmed);
				this.preloadPromises.delete(trimmed);
			}
		};
		this.preloadPromises.set(trimmed, run());
	}
	releasePreload() {
		for (const abort of this.preloadAborts.values()) abort.abort();
		this.preloadAborts.clear();
		this.preloadPromises.clear();
	}
	getMediaElement() {
		return null;
	}
	getInfo() {
		return this.info;
	}
	destroy() {
		this.generation += 1;
		this.abortFetch();
		this.stopSourceNode();
		this.releasePreload();
		sharedAudioBufferCache.clear();
		this.buffer = null;
		this.offset = 0;
		this.lastError = null;
		this.loadPromise = null;
		this.state = "idle";
		if (this.panner) {
			try {
				this.panner.disconnect();
			} catch {}
			this.panner = null;
		}
		if (this.stereoPanner) {
			try {
				this.stereoPanner.disconnect();
			} catch {}
			this.stereoPanner = null;
		}
		if (this.gain) {
			try {
				this.gain.disconnect();
			} catch {}
			this.gain = null;
		}
		if (this.ctx) releaseSharedContext(this.ctx);
		this.ctx = null;
	}
	supportsSpatial() {
		return true;
	}
	setStereo(pan) {
		this.stereoPan = Math.max(-1, Math.min(1, pan));
		if (this.stereoPanner) this.stereoPanner.pan.value = this.stereoPan;
	}
	getStereo() {
		return this.stereoPan;
	}
	setPos(x, y, z) {
		this.position = [
			x,
			y,
			z
		];
		if (this.panner) {
			this.panner.positionX.value = x;
			this.panner.positionY.value = y;
			this.panner.positionZ.value = z;
		}
	}
	getPos() {
		return this.position;
	}
	setOrientation(x, y, z) {
		this.orientation = [
			x,
			y,
			z
		];
		if (this.panner) {
			this.panner.orientationX.value = x;
			this.panner.orientationY.value = y;
			this.panner.orientationZ.value = z;
		}
	}
	getOrientation() {
		return this.orientation;
	}
	setRate(rate) {
		const clamped = Math.max(.5, Math.min(4, rate));
		this.rate = clamped;
		if (this.source) this.source.playbackRate.value = clamped;
	}
	getRate() {
		return this.rate;
	}
	setDistanceModel(model) {
		this.distanceModel = model;
		if (this.panner) this.panner.distanceModel = model;
	}
	getDistanceModel() {
		return this.distanceModel;
	}
	setRefDistance(distance) {
		this.refDistance = Math.max(0, distance);
		if (this.panner) this.panner.refDistance = this.refDistance;
	}
	getRefDistance() {
		return this.refDistance;
	}
	setMaxDistance(distance) {
		this.maxDistance = Math.max(0, distance);
		if (this.panner) this.panner.maxDistance = this.maxDistance;
	}
	getMaxDistance() {
		return this.maxDistance;
	}
	setRolloffFactor(factor) {
		this.rolloffFactor = Math.max(0, factor);
		if (this.panner) this.panner.rolloffFactor = this.rolloffFactor;
	}
	getRolloffFactor() {
		return this.rolloffFactor;
	}
	setConeInnerAngle(angle) {
		this.coneInnerAngle = Math.max(0, Math.min(360, angle));
		if (this.panner) this.panner.coneInnerAngle = this.coneInnerAngle;
	}
	getConeInnerAngle() {
		return this.coneInnerAngle;
	}
	setConeOuterAngle(angle) {
		this.coneOuterAngle = Math.max(0, Math.min(360, angle));
		if (this.panner) this.panner.coneOuterAngle = this.coneOuterAngle;
	}
	getConeOuterAngle() {
		return this.coneOuterAngle;
	}
	setConeOuterGain(gain) {
		this.coneOuterGain = Math.max(0, Math.min(1, gain));
		if (this.panner) this.panner.coneOuterGain = this.coneOuterGain;
	}
	getConeOuterGain() {
		return this.coneOuterGain;
	}
	setLiteMode(enabled) {
		if (enabled === this.liteMode) return;
		this.liteMode = enabled;
		if (this.panner && this.ctx) {
			const oldPanner = this.panner;
			const newPanner = this.ctx.createPanner();
			newPanner.panningModel = enabled ? "equalpower" : "HRTF";
			newPanner.distanceModel = this.distanceModel;
			newPanner.refDistance = this.refDistance;
			newPanner.maxDistance = this.maxDistance;
			newPanner.rolloffFactor = this.rolloffFactor;
			newPanner.coneInnerAngle = this.coneInnerAngle;
			newPanner.coneOuterAngle = this.coneOuterAngle;
			newPanner.coneOuterGain = this.coneOuterGain;
			newPanner.positionX.value = this.position[0];
			newPanner.positionY.value = this.position[1];
			newPanner.positionZ.value = this.position[2];
			newPanner.orientationX.value = this.orientation[0];
			newPanner.orientationY.value = this.orientation[1];
			newPanner.orientationZ.value = this.orientation[2];
			if (this.source) {
				try {
					this.source.disconnect(oldPanner);
				} catch {}
				this.source.connect(newPanner);
			}
			try {
				oldPanner.disconnect(this.stereoPanner);
			} catch {}
			newPanner.connect(this.stereoPanner);
			this.panner = newPanner;
		}
	}
	isLiteMode() {
		return this.liteMode;
	}
	/**
	* Get the shared AudioContext for global listener control.
	* Returns null if the context hasn't been created yet.
	* Use this to control the global listener position/orientation.
	*/
	getAudioContext() {
		return this.ctx;
	}
};
//#endregion
//#region src/audio-player/core/audio/AudioBackendFactory.ts
/**
* Returns why the Web Audio backend cannot run in this environment, or null
* when it is supported.
*/
function webAudioUnsupportedReason() {
	if (typeof window === "undefined") return "no window (non-browser environment)";
	if (!(window.AudioContext ?? window.webkitAudioContext)) return "AudioContext is not available";
	if (typeof fetch !== "function") return "fetch is not available";
	return null;
}
/**
* Instantiate the requested playback backend, falling back to HTML5 Audio
* (with a console warning) when Web Audio is unavailable.
*/
function createAudioBackend(requested, deps) {
	if (requested === "webaudio") {
		const reason = webAudioUnsupportedReason();
		if (!reason) return new WebAudioBackend({
			requested: "webaudio",
			active: "webaudio",
			didFallback: false,
			capabilities: WEBAUDIO_CAPABILITIES
		});
		console.warn(`[AudioPlayer] Web Audio API not available (${reason}); falling back to HTML5 audio backend.`);
		return new HTML5AudioBackend(deps.audioRef, {
			requested: "webaudio",
			active: "html5",
			didFallback: true,
			fallbackReason: reason,
			capabilities: HTML5_CAPABILITIES
		});
	}
	return new HTML5AudioBackend(deps.audioRef, {
		requested: "html5",
		active: "html5",
		didFallback: false,
		capabilities: HTML5_CAPABILITIES
	});
}
/**
* Whether a `waiting`/`stalled` event should be treated as real buffering.
*
* True only when playback is actually active or a play attempt is pending;
* passive preload while paused must not show a spinner.
*/
function shouldEnterBuffering({ isPlaying, isPaused, hasPendingPlay }) {
	return isPlaying || hasPendingPlay || !isPaused;
}
/**
* Build a debouncer for the buffering spinner. Kept pure (injectable timers) so
* the schedule/cancel/don't-restart contract is unit-testable without a DOM,
* while the engine wires it to the real media events.
*/
function createBufferingDebounce(delayMs = 300, scheduler = {
	setTimer: setTimeout,
	clearTimer: clearTimeout
}) {
	let handle = null;
	return {
		schedule(show) {
			if (handle !== null) return;
			handle = scheduler.setTimer(() => {
				handle = null;
				show();
			}, delayMs);
		},
		cancel() {
			if (handle !== null) {
				scheduler.clearTimer(handle);
				handle = null;
			}
		}
	};
}
//#endregion
//#region src/audio-player/utils/sources.ts
function getUrlBase() {
	if (typeof globalThis !== "undefined") {
		const location = globalThis.location;
		if (location?.href) return location.href;
	}
	return "http://localhost/";
}
/**
* Normalize a source URL once at the source-resolution boundary so playback,
* waveform, automix, cache keys, and fallback comparisons all speak the same
* URL language. Relative URLs become absolute in browser environments, matching
* what HTMLMediaElement.currentSrc reports after the browser resolves `src`.
*/
function normalizeSourceUrl(url) {
	const trimmed = url.trim();
	if (!trimmed) return "";
	try {
		return new URL(trimmed, getUrlBase()).href;
	} catch {
		return trimmed;
	}
}
function normalizeSource$1(source) {
	const url = normalizeSourceUrl(source.url ?? "");
	if (!url) return null;
	const type = source.type?.trim();
	return type ? {
		url,
		type
	} : { url };
}
function dedupeSources$1(sources) {
	const seen = /* @__PURE__ */ new Set();
	const next = [];
	for (const source of sources) {
		const normalized = normalizeSource$1(source);
		if (!normalized || seen.has(normalized.url)) continue;
		seen.add(normalized.url);
		next.push(normalized);
	}
	return next;
}
/**
* Resolve the ordered source list for a track.
*
* `track.sources` is authoritative when present and non-empty. Otherwise the
* legacy `audioFile` remains the primary URL and `fallbackSources` are appended.
*/
function getTrackSources(track) {
	if (!track) return [];
	const declaredSources = dedupeSources$1(track.sources ?? []);
	if (declaredSources.length > 0) return declaredSources;
	return dedupeSources$1([{ url: track.audioFile ?? "" }, ...(track.fallbackSources ?? []).map((url) => ({ url }))]);
}
/** First playable URL for a track after source normalization. */
function getPrimaryTrackSource(track) {
	return getTrackSources(track)[0]?.url ?? "";
}
/** Stable signature used to detect source-list changes without storing objects. */
function trackSourcesSignature(track) {
	return JSON.stringify(getTrackSources(track).map((source) => [source.url, source.type ?? ""]));
}
//#endregion
//#region src/audio-player/useAudioPlayer.ts
function normalizeSource(source) {
	const url = source.url?.trim() ?? "";
	if (!url) return null;
	const type = source.type?.trim();
	return type ? {
		url,
		type
	} : { url };
}
function dedupeSources(sourceList) {
	const seen = /* @__PURE__ */ new Set();
	const next = [];
	for (const source of sourceList) {
		const normalized = normalizeSource(source);
		if (!normalized || seen.has(normalized.url)) continue;
		seen.add(normalized.url);
		next.push(normalized);
	}
	return next;
}
function resolveEngineSources(src, sources, fallbackSources) {
	const declaredSources = dedupeSources(sources ?? []);
	if (declaredSources.length > 0) return declaredSources;
	return dedupeSources([{ url: src }, ...(fallbackSources ?? []).map((url) => ({ url }))]);
}
function sourceListSignature(sources) {
	return JSON.stringify(sources.map((source) => [source.url, source.type ?? ""]));
}
/**
* Headless audio engine. Owns a playback backend (HTML5 `<audio>` element by
* default, Web Audio API on request) and is the sole source of truth for
* playback state. UI components read state and call actions; they never touch
* the backend directly.
*
* Notable behavior:
* - `currentTime` is driven by a single rAF loop while playing, and set
*   explicitly on seek / pause / metadata. There is no second update path.
* - When `src` changes, playback continues automatically if it was playing
*   (track-change UX). The very first load only plays when `autoPlay` is set.
* - Browsers block audible autoplay without a user gesture; `autoPlay` is a
*   best-effort attempt, not a guarantee. When blocked, the engine exposes an
*   `autoplayBlocked` flag so the UI can prompt the user for a tap.
* - A monotonic `playbackToken` is bumped on every source / play-attempt
*   boundary. Async callbacks captured before the swap check the token and
*   no-op if it has changed, which removes the rapid-track-skip race.
* - The backend is fixed at mount; remount (e.g. via `key`) to switch.
*/
function useAudioPlayer(options) {
	const { src, fallbackSources, sources, sourceKey = src, autoPlay = false, loop = false, onEnded, onFallbackSource, audioBackend = "html5" } = options;
	const resolvedSources = useMemo(() => resolveEngineSources(src, sources, fallbackSources), [
		fallbackSources,
		sources,
		src
	]);
	const sourcesSignature = useMemo(() => sourceListSignature(resolvedSources), [resolvedSources]);
	const [activeSourceState, setActiveSourceState] = useState(() => ({
		sourceKey,
		signature: sourcesSignature,
		index: 0
	}));
	const currentSourceIndex = activeSourceState.sourceKey === sourceKey && activeSourceState.signature === sourcesSignature ? Math.max(0, Math.min(activeSourceState.index, resolvedSources.length - 1)) : 0;
	const currentSrc = (resolvedSources[currentSourceIndex] ?? null)?.url ?? "";
	const audioRef = useRef(null);
	const backendRef = useRef(null);
	if (backendRef.current === null) backendRef.current = createAudioBackend(audioBackend, { audioRef });
	const backendChangeWarnedRef = useRef(false);
	if (backendRef.current.getInfo().requested !== audioBackend && !backendChangeWarnedRef.current) {
		backendChangeWarnedRef.current = true;
		console.warn("[AudioPlayer] audioBackend changed after mount; the backend is fixed at mount. Remount the player (e.g. with a key) to switch.");
	}
	const currentTimeRef = useRef(0);
	const isSeekingRef = useRef(false);
	const isPlayingRef = useRef(false);
	const playPromiseRef = useRef(null);
	const animationFrameRef = useRef(null);
	const fadeFrameRef = useRef(null);
	const bufferingDebounceRef = useRef(null);
	if (bufferingDebounceRef.current === null) bufferingDebounceRef.current = createBufferingDebounce();
	const isFirstLoadRef = useRef(true);
	const previousVolumeRef = useRef(1);
	const pendingSeekRef = useRef(null);
	const onEndedRef = useRef(onEnded);
	onEndedRef.current = onEnded;
	const onFallbackSourceRef = useRef(onFallbackSource);
	onFallbackSourceRef.current = onFallbackSource;
	const sourceListRef = useRef(resolvedSources);
	const sourceKeyRef = useRef(sourceKey);
	const sourcesSignatureRef = useRef(sourcesSignature);
	const currentSourceIndexRef = useRef(currentSourceIndex);
	const currentSrcRef = useRef(currentSrc);
	const fallbackShouldPlayRef = useRef(null);
	sourceListRef.current = resolvedSources;
	sourceKeyRef.current = sourceKey;
	sourcesSignatureRef.current = sourcesSignature;
	currentSourceIndexRef.current = currentSourceIndex;
	currentSrcRef.current = currentSrc;
	/**
	* Bumped on any operation that should invalidate in-flight async audio
	* callbacks (src change, retry, loadAndPlay). Comparing the captured token
	* to the latest token is how we keep stale `play().then/.catch` from
	* clobbering state after a fast track skip.
	*/
	const playbackTokenRef = useRef(0);
	/**
	* Stores the last token for which we already raised the autoplay-blocked
	* affordance, so we don't spam a state update for every rejected promise.
	*/
	const lastAutoplayBlockedTokenRef = useRef(-1);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [buffered, setBuffered] = useState(0);
	const [bufferedRanges, setBufferedRanges] = useState([]);
	const [volume, setVolumeState] = useState(1);
	const [isMuted, setIsMuted] = useState(false);
	const [isSeeking, setIsSeekingState] = useState(false);
	const [isBuffering, setIsBuffering] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [autoplayBlocked, setAutoplayBlocked] = useState(false);
	const volumeUnsupportedRef = useRef(false);
	const [volumeUnsupported, setVolumeUnsupported] = useState(false);
	const hasAudio = currentSrc.trim().length > 0;
	const bumpToken = useCallback(() => {
		playbackTokenRef.current += 1;
		return playbackTokenRef.current;
	}, []);
	const clearPendingPlay = useCallback(() => {
		if (playPromiseRef.current) {
			playPromiseRef.current.catch(() => {});
			playPromiseRef.current = null;
		}
	}, []);
	const stopLoop = useCallback(() => {
		if (animationFrameRef.current !== null) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
	}, []);
	const clearBufferingTimer = useCallback(() => {
		bufferingDebounceRef.current?.cancel();
	}, []);
	const tryFallbackSource = useCallback((failedSource, error, shouldPlayAfterSwitch) => {
		const sourceList = sourceListRef.current;
		const failedUrl = failedSource.trim();
		const previousActiveSource = currentSrcRef.current;
		const activeIndex = currentSourceIndexRef.current;
		const failedIndex = failedUrl ? sourceList.findIndex((source) => source.url === failedUrl) : -1;
		const nextIndex = (failedIndex >= 0 ? failedIndex : activeIndex) + 1;
		if (nextIndex <= activeIndex) return true;
		if (nextIndex >= sourceList.length) return false;
		const nextSource = sourceList[nextIndex];
		if (!nextSource?.url) return false;
		bumpToken();
		clearPendingPlay();
		stopLoop();
		backendRef.current?.pause();
		if (fadeFrameRef.current !== null) {
			cancelAnimationFrame(fadeFrameRef.current);
			fadeFrameRef.current = null;
		}
		fallbackShouldPlayRef.current = shouldPlayAfterSwitch;
		currentSourceIndexRef.current = nextIndex;
		currentSrcRef.current = nextSource.url;
		setHasError(false);
		setErrorMessage("");
		setAutoplayBlocked(false);
		clearBufferingTimer();
		setIsBuffering(shouldPlayAfterSwitch);
		setActiveSourceState({
			sourceKey: sourceKeyRef.current,
			signature: sourcesSignatureRef.current,
			index: nextIndex
		});
		onFallbackSourceRef.current?.({
			failedSource: failedUrl || previousActiveSource,
			nextSource: nextSource.url,
			nextSourceType: nextSource.type,
			sourceIndex: nextIndex,
			sourceCount: sourceList.length,
			error: error ?? null
		});
		return true;
	}, [
		bumpToken,
		clearPendingPlay,
		stopLoop,
		clearBufferingTimer
	]);
	const setSeeking = useCallback((active) => {
		isSeekingRef.current = active;
		setIsSeekingState(active);
	}, []);
	const play = useCallback((reportError = true) => {
		const backend = backendRef.current;
		if (!backend.isAttached() || !hasAudio) return;
		const token = bumpToken();
		clearPendingPlay();
		setHasError(false);
		setErrorMessage("");
		let playPromise;
		try {
			playPromise = backend.play();
		} catch (error) {
			if (playbackTokenRef.current !== token) return;
			const name = error instanceof Error ? error.name : "";
			if (tryFallbackSource(currentSrcRef.current, name || "unknown", true)) return;
			if (reportError) {
				setHasError(true);
				setErrorMessage("Playback failed. Please try again.");
			}
			return;
		}
		playPromiseRef.current = playPromise;
		playPromise.then(() => {
			if (playbackTokenRef.current !== token) return;
			if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
		}).catch((error) => {
			if (playbackTokenRef.current !== token) return;
			if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
			const name = error instanceof Error ? error.name : "";
			if (name === "AbortError") return;
			if (name === "NotAllowedError") {
				if (lastAutoplayBlockedTokenRef.current !== token) {
					lastAutoplayBlockedTokenRef.current = token;
					setAutoplayBlocked(true);
				}
				setIsPlaying(false);
				clearBufferingTimer();
				setIsBuffering(false);
				return;
			}
			if (tryFallbackSource(backend.getMediaElement()?.currentSrc || currentSrcRef.current, name || backend.getError() || "unknown", true)) return;
			setIsPlaying(false);
			clearBufferingTimer();
			setIsBuffering(false);
			if (reportError) {
				setHasError(true);
				setErrorMessage(name === "NotSupportedError" ? "Audio file not found or format not supported." : "Playback failed. Please try again.");
			}
		});
	}, [
		bumpToken,
		clearPendingPlay,
		hasAudio,
		tryFallbackSource,
		clearBufferingTimer
	]);
	const pause = useCallback(() => {
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		const pending = playPromiseRef.current;
		if (pending) {
			bumpToken();
			pending.catch(() => {}).finally(() => {
				if (playPromiseRef.current === pending) playPromiseRef.current = null;
				backend.pause();
			});
			return;
		}
		backend.pause();
	}, [bumpToken]);
	const toggle = useCallback(() => {
		if (!hasAudio) return;
		if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") try {
			navigator.vibrate(10);
		} catch (err) {}
		if (isPlayingRef.current) pause();
		else play(true);
	}, [
		hasAudio,
		pause,
		play
	]);
	const seek = useCallback((time) => {
		const backend = backendRef.current;
		if (!backend.isAttached() || !hasAudio) return;
		if (duration <= 0) {
			pendingSeekRef.current = time;
			return;
		}
		pendingSeekRef.current = null;
		const next = Math.max(0, Math.min(duration, time));
		backend.setCurrentTime(next);
		currentTimeRef.current = next;
		setCurrentTime(next);
	}, [duration, hasAudio]);
	const seekBy = useCallback((delta) => {
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		seek(backend.getCurrentTime() + delta);
	}, [seek]);
	const setVolume = useCallback((value) => {
		if (fadeFrameRef.current !== null) {
			cancelAnimationFrame(fadeFrameRef.current);
			fadeFrameRef.current = null;
		}
		const backend = backendRef.current;
		const next = Math.max(0, Math.min(1, value));
		previousVolumeRef.current = next > 0 ? next : previousVolumeRef.current;
		setVolumeState(next);
		if (backend.isAttached()) {
			if (!volumeUnsupportedRef.current && next !== 0) {
				backend.setVolume(next);
				if (Math.abs(backend.getVolume() - next) > .001) {
					volumeUnsupportedRef.current = true;
					setVolumeUnsupported(true);
				}
			} else backend.setVolume(next);
			if (next > 0 && backend.isMuted()) {
				backend.setMuted(false);
				setIsMuted(false);
			}
		}
	}, []);
	const toggleMute = useCallback(() => {
		if (fadeFrameRef.current !== null) {
			cancelAnimationFrame(fadeFrameRef.current);
			fadeFrameRef.current = null;
		}
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		const nextMuted = !backend.isMuted();
		backend.setMuted(nextMuted);
		setIsMuted(nextMuted);
		if (!nextMuted && backend.getVolume() === 0) {
			const restored = previousVolumeRef.current || 1;
			backend.setVolume(restored);
			setVolumeState(restored);
		}
	}, []);
	const retry = useCallback(() => {
		const backend = backendRef.current;
		if (!backend.isAttached() || !hasAudio) return;
		bumpToken();
		clearPendingPlay();
		setHasError(false);
		setErrorMessage("");
		setAutoplayBlocked(false);
		clearBufferingTimer();
		setIsBuffering(true);
		backend.load();
		play(true);
	}, [
		bumpToken,
		clearPendingPlay,
		clearBufferingTimer,
		hasAudio,
		play
	]);
	const loadAndPlay = useCallback(() => {
		const backend = backendRef.current;
		if (!backend.isAttached() || !hasAudio) return;
		bumpToken();
		backend.load();
		play(true);
	}, [
		bumpToken,
		hasAudio,
		play
	]);
	const dismissAutoplayBlocked = useCallback(() => {
		setAutoplayBlocked(false);
	}, []);
	const preload = useCallback((track) => {
		for (const source of getTrackSources(track)) backendRef.current.preload(source.url);
	}, []);
	const unload = useCallback(() => {
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		bumpToken();
		clearPendingPlay();
		stopLoop();
		backend.pause();
		backend.clearSource();
		currentTimeRef.current = 0;
		setCurrentTime(0);
		setDuration(0);
		setBuffered(0);
		setBufferedRanges([]);
		setIsPlaying(false);
		isPlayingRef.current = false;
		setHasError(false);
		setErrorMessage("");
		clearBufferingTimer();
		setIsBuffering(false);
		setAutoplayBlocked(false);
		pendingSeekRef.current = null;
		if (fadeFrameRef.current !== null) {
			cancelAnimationFrame(fadeFrameRef.current);
			fadeFrameRef.current = null;
		}
		backend.releasePreload();
	}, [
		bumpToken,
		clearPendingPlay,
		stopLoop,
		clearBufferingTimer
	]);
	const fade = useCallback((to, durationMs) => {
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		const target = Math.max(0, Math.min(1, to));
		if (durationMs <= 0) {
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			backend.setVolume(target);
			setVolumeState(target);
			return;
		}
		const startVolume = backend.getVolume();
		const startTime = performance.now();
		if (fadeFrameRef.current !== null) cancelAnimationFrame(fadeFrameRef.current);
		const step = (now) => {
			const elapsed = now - startTime;
			const progress = Math.min(1, elapsed / durationMs);
			const next = startVolume + (target - startVolume) * progress;
			const clamped = Math.max(0, Math.min(1, next));
			backend.setVolume(clamped);
			setVolumeState(clamped);
			if (progress < 1) fadeFrameRef.current = requestAnimationFrame(step);
			else fadeFrameRef.current = null;
		};
		fadeFrameRef.current = requestAnimationFrame(step);
	}, []);
	useEffect(() => {
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		let lastUpdate = 0;
		const readBuffered = () => {
			try {
				const ranges = backend.getBufferedRanges();
				if (ranges.length > 0) {
					let furthest = 0;
					for (const range of ranges) if (range.end > furthest) furthest = range.end;
					setBufferedRanges(ranges);
					setBuffered(furthest);
				} else {
					setBufferedRanges([]);
					setBuffered(0);
				}
			} catch {}
		};
		const loop = (timestamp) => {
			if (!isSeekingRef.current) {
				currentTimeRef.current = backend.getCurrentTime();
				if (timestamp - lastUpdate >= 16) {
					setCurrentTime(backend.getCurrentTime());
					lastUpdate = timestamp;
				}
			}
			if (!backend.isPaused() && !backend.isEnded()) animationFrameRef.current = requestAnimationFrame(loop);
			else animationFrameRef.current = null;
		};
		const handlePlay = () => {
			isPlayingRef.current = true;
			setIsPlaying(true);
			clearBufferingTimer();
			setIsBuffering(false);
			setAutoplayBlocked(false);
			if (animationFrameRef.current === null) animationFrameRef.current = requestAnimationFrame(loop);
		};
		const handlePause = () => {
			isPlayingRef.current = false;
			setIsPlaying(false);
			clearBufferingTimer();
			setIsBuffering(false);
			stopLoop();
			currentTimeRef.current = backend.getCurrentTime();
			setCurrentTime(backend.getCurrentTime());
		};
		const handleEnded = () => {
			isPlayingRef.current = false;
			setIsPlaying(false);
			clearBufferingTimer();
			setIsBuffering(false);
			stopLoop();
			setCurrentTime(backend.getDuration() || backend.getCurrentTime());
			onEndedRef.current?.();
		};
		const handleLoadedMetadata = () => {
			const rawDuration = backend.getDuration();
			const loadedDuration = Number.isFinite(rawDuration) ? rawDuration : 0;
			setDuration(loadedDuration);
			const pending = pendingSeekRef.current;
			if (pending !== null && loadedDuration > 0) {
				pendingSeekRef.current = null;
				const clamped = Math.max(0, Math.min(loadedDuration, pending));
				backend.setCurrentTime(clamped);
				currentTimeRef.current = clamped;
				setCurrentTime(clamped);
			}
		};
		const handleWaiting = () => {
			if (!shouldEnterBuffering({
				isPlaying: isPlayingRef.current,
				isPaused: backend.isPaused(),
				hasPendingPlay: playPromiseRef.current !== null
			})) return;
			bufferingDebounceRef.current?.schedule(() => setIsBuffering(true));
		};
		const clearBuffering = () => {
			clearBufferingTimer();
			setIsBuffering(false);
		};
		const handleError = () => {
			const error = backend.getError();
			const failedSource = currentSrcRef.current;
			if (tryFallbackSource(failedSource, error, isPlayingRef.current || playPromiseRef.current !== null)) return;
			clearBufferingTimer();
			setIsBuffering(false);
			isPlayingRef.current = false;
			setIsPlaying(false);
			setHasError(true);
			switch (error) {
				case "aborted":
					setErrorMessage("Playback was aborted. Please try again.");
					break;
				case "network":
					setErrorMessage("Network error. Check your connection and try again.");
					break;
				case "decode":
					setErrorMessage("Audio file is corrupted or unsupported.");
					break;
				case "src-not-supported":
					setErrorMessage("Audio file not found or format not supported.");
					break;
				default: setErrorMessage("Failed to load audio. Please try again.");
			}
		};
		const handleLoadStart = () => {
			setHasError(false);
			setErrorMessage("");
		};
		backend.addEventListener("play", handlePlay);
		backend.addEventListener("pause", handlePause);
		backend.addEventListener("ended", handleEnded);
		backend.addEventListener("loadedmetadata", handleLoadedMetadata);
		backend.addEventListener("waiting", handleWaiting);
		backend.addEventListener("stalled", handleWaiting);
		backend.addEventListener("canplay", clearBuffering);
		backend.addEventListener("canplaythrough", clearBuffering);
		backend.addEventListener("playing", clearBuffering);
		backend.addEventListener("progress", readBuffered);
		backend.addEventListener("timeupdate", readBuffered);
		backend.addEventListener("error", handleError);
		backend.addEventListener("loadstart", handleLoadStart);
		if (backend.hasMetadata()) {
			handleLoadedMetadata();
			readBuffered();
		}
		return () => {
			stopLoop();
			clearBufferingTimer();
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			backend.removeEventListener("play", handlePlay);
			backend.removeEventListener("pause", handlePause);
			backend.removeEventListener("ended", handleEnded);
			backend.removeEventListener("loadedmetadata", handleLoadedMetadata);
			backend.removeEventListener("waiting", handleWaiting);
			backend.removeEventListener("stalled", handleWaiting);
			backend.removeEventListener("canplay", clearBuffering);
			backend.removeEventListener("canplaythrough", clearBuffering);
			backend.removeEventListener("playing", clearBuffering);
			backend.removeEventListener("progress", readBuffered);
			backend.removeEventListener("timeupdate", readBuffered);
			backend.removeEventListener("error", handleError);
			backend.removeEventListener("loadstart", handleLoadStart);
		};
	}, [
		stopLoop,
		tryFallbackSource,
		clearBufferingTimer
	]);
	useEffect(() => {
		const backend = backendRef.current;
		if (!backend.isAttached()) return;
		const isFallbackSwitch = fallbackShouldPlayRef.current !== null;
		const isFirstLoad = isFirstLoadRef.current;
		isFirstLoadRef.current = false;
		const wasPlaying = isPlayingRef.current;
		const shouldPlay = isFallbackSwitch ? fallbackShouldPlayRef.current === true : isFirstLoad ? autoPlay : wasPlaying;
		fallbackShouldPlayRef.current = null;
		const token = bumpToken();
		clearPendingPlay();
		stopLoop();
		backend.pause();
		if (fadeFrameRef.current !== null) {
			cancelAnimationFrame(fadeFrameRef.current);
			fadeFrameRef.current = null;
		}
		if (!isFirstLoad) {
			backend.setCurrentTime(0);
			currentTimeRef.current = 0;
			setSeeking(false);
			setCurrentTime(0);
			setDuration(0);
			setBuffered(0);
			setBufferedRanges([]);
			setIsPlaying(false);
			setHasError(false);
			setErrorMessage("");
			clearBufferingTimer();
			setIsBuffering(false);
			setAutoplayBlocked(false);
			pendingSeekRef.current = null;
		}
		if (!hasAudio) {
			backend.clearSource();
			return;
		}
		backend.setSource(currentSrc);
		if (!isFirstLoad) backend.load();
		if (shouldPlay) if (isFirstLoad) {
			let playPromise;
			try {
				playPromise = backend.play();
			} catch {
				return;
			}
			if (playPromise) {
				playPromiseRef.current = playPromise;
				playPromise.then(() => {
					if (playbackTokenRef.current !== token) return;
					if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
				}).catch((error) => {
					if (playbackTokenRef.current !== token) return;
					if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
					const name = error instanceof Error ? error.name : "";
					if (name === "AbortError") return;
					if (name === "NotAllowedError") {
						if (lastAutoplayBlockedTokenRef.current !== token) {
							lastAutoplayBlockedTokenRef.current = token;
							setAutoplayBlocked(true);
						}
						setIsPlaying(false);
						clearBufferingTimer();
						setIsBuffering(false);
						return;
					}
					setHasError(true);
					setErrorMessage(name === "NotSupportedError" ? "Audio file not found or format not supported." : "Playback failed. Please try again.");
				});
			}
		} else play(!isFirstLoad);
	}, [
		currentSrc,
		sourceKey,
		sourcesSignature
	]);
	useEffect(() => {
		const backend = backendRef.current;
		if (backend.isAttached()) backend.setVolume(volume);
	}, [volume]);
	useEffect(() => {
		const backend = backendRef.current;
		if (backend.isAttached()) backend.setLoop(loop);
	}, [loop]);
	useEffect(() => {
		return () => {
			backendRef.current?.destroy();
		};
	}, []);
	const getBackendInfo = useCallback(() => backendRef.current.getInfo(), []);
	const getDecodedData = useCallback(() => backendRef.current.getDecodedData(), []);
	return {
		audioRef,
		isPlaying,
		currentTime,
		duration,
		buffered,
		bufferedRanges,
		volume,
		isMuted,
		isBuffering,
		isSeeking,
		hasError,
		errorMessage,
		hasAudio,
		currentSrc,
		currentSourceIndex,
		sourceCount: resolvedSources.length,
		volumeUnsupported,
		autoplayBlocked,
		play,
		pause,
		toggle,
		seek,
		seekBy,
		setSeeking,
		setVolume,
		toggleMute,
		retry,
		loadAndPlay,
		dismissAutoplayBlocked,
		preload,
		unload,
		fade,
		getBackendInfo,
		getDecodedData
	};
}
//#endregion
//#region src/audio-player/utils/trackKey.ts
/**
* Returns a stable string that uniquely identifies a track.
*
* Prefers `track.id` when set — the cheapest, most reliable key.
* Falls back to a composite of title + artist + source list for tracks that
* were created before `id` was introduced. The fallback is good enough for
* small playlists but can collide at Vault scale (duplicate titles, shared
* CDN URLs after normalisation, stems/mixes with similar names), which is
* why setting `id` is strongly recommended for production use.
*/
function trackKey(track) {
	if (!track) return "";
	if (track.id) return `id:${track.id}`;
	return `t:${JSON.stringify([
		track.title ?? "",
		track.artist ?? "",
		trackSourcesSignature(track)
	])}`;
}
//#endregion
//#region src/audio-player/automix/decodeTrack.ts
/**
* Shared fetch + decode pipeline for automix track analysis.
*
* Extracted from the Automix Lite silence analysis so the Pro analysis can
* reuse one download/decode per track. Every failure mode (no Web Audio,
* CORS-blocked fetch, decode error, file too large, timeout) resolves to
* `null`; callers treat that as "no analysis available".
*/
/** Skip analysis for files larger than this (decode memory + bandwidth). */
var MAX_FILE_BYTES = 30 * 1024 * 1024;
/** Skip analysis for tracks longer than this. */
var MAX_DURATION_S = 900;
var FETCH_TIMEOUT_MS = 1e4;
function getDecodeContext() {
	if (typeof window === "undefined") return null;
	try {
		const Ctor = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
		if (!Ctor) return null;
		return new Ctor(1, 1, 44100);
	} catch {
		return null;
	}
}
/** decodeAudioData with support for callback-only (older WebKit) signatures. */
function decode$1(ctx, data) {
	return new Promise((resolve, reject) => {
		try {
			const maybePromise = ctx.decodeAudioData(data, resolve, reject);
			if (maybePromise && typeof maybePromise.then === "function") maybePromise.then(resolve, reject);
		} catch (error) {
			reject(error);
		}
	});
}
/**
* Download and decode a track within the conservative size/duration limits.
* Resolves to `null` on any failure.
*/
async function fetchAndDecodeTrack(url) {
	if (typeof window === "undefined" || typeof fetch !== "function") return null;
	const ctx = getDecodeContext();
	if (!ctx) return null;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) return null;
		if (Number(response.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) return null;
		const data = await response.arrayBuffer();
		if (data.byteLength === 0 || data.byteLength > MAX_FILE_BYTES) return null;
		const buffer = await decode$1(ctx, data);
		if (buffer.duration > MAX_DURATION_S) return null;
		return buffer;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
//#endregion
//#region src/audio-player/automix/silenceAnalysis.ts
/**
* Conservative silence trimming for Automix Lite.
*
* Downloads a track, decodes it, and RMS-scans the first/last seconds for
* near-silence so crossfades don't run through dead air. This is deliberately
* simple amplitude analysis — no BPM, beat grids, or song-structure detection.
*
* Every failure mode (no Web Audio, CORS-blocked fetch, decode error, file too
* large, timeout) resolves to `null`, which callers treat as "no trims": the
* track plays from its natural start to its natural end exactly as it would
* with Automix off.
*/
/** RMS scan window. */
var WINDOW_MS = 50;
/** Amplitude floor treated as silence (~ -40 dBFS). */
var RMS_THRESHOLD = .01;
/** Never trim more than this from the head of a track. */
var MAX_TRIM_START_MS = 12e3;
/** Never trim more than this from the tail of a track. */
var MAX_TRIM_END_MS = 2e4;
/** If trims would leave less audio than this, distrust them entirely. */
var MIN_REMAINING_S = 10;
var NO_TRIMS = {
	trimStartMs: 0,
	trimEndMs: 0
};
/** In-flight + settled analysis per trackKey, so a track is analyzed once. */
var pending$1 = /* @__PURE__ */ new Map();
/** Settled results for synchronous reads from the playback hot path. */
var settled$1 = /* @__PURE__ */ new Map();
/** Serializes analyses so at most one decode is in memory at a time. */
var lastJob$1 = Promise.resolve();
/**
* RMS-scan the first/last seconds of a decoded buffer for near-silence.
* Pure: also used by the Automix Pro analysis on its shared decode.
*/
function scanSilenceEdges(buffer) {
	const win = Math.max(1, Math.round(WINDOW_MS / 1e3 * buffer.sampleRate));
	const length = buffer.length;
	const channels = [];
	for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) channels.push(buffer.getChannelData(c));
	if (channels.length === 0 || length < win) return NO_TRIMS;
	const windowRms = (start) => {
		const end = Math.min(length, start + win);
		let loudest = 0;
		for (const data of channels) {
			let sum = 0;
			for (let i = start; i < end; i++) {
				const v = data[i];
				sum += v * v;
			}
			const rms = Math.sqrt(sum / (end - start));
			if (rms > loudest) loudest = rms;
		}
		return loudest;
	};
	const totalWindows = Math.floor(length / win);
	let trimStartMs = 0;
	const headWindows = Math.min(totalWindows, Math.ceil(MAX_TRIM_START_MS / WINDOW_MS));
	for (let w = 0; w < headWindows; w++) {
		if (windowRms(w * win) >= RMS_THRESHOLD) {
			trimStartMs = w * WINDOW_MS;
			break;
		}
		trimStartMs = (w + 1) * WINDOW_MS;
	}
	trimStartMs = Math.min(trimStartMs, MAX_TRIM_START_MS);
	let trimEndMs = 0;
	const tailWindows = Math.min(totalWindows, Math.ceil(MAX_TRIM_END_MS / WINDOW_MS));
	for (let w = 0; w < tailWindows; w++) {
		const start = length - (w + 1) * win;
		if (start < 0) break;
		if (windowRms(start) >= RMS_THRESHOLD) {
			trimEndMs = w * WINDOW_MS;
			break;
		}
		trimEndMs = (w + 1) * WINDOW_MS;
	}
	trimEndMs = Math.min(trimEndMs, MAX_TRIM_END_MS);
	if (buffer.duration * 1e3 - trimStartMs - trimEndMs < MIN_REMAINING_S * 1e3) return NO_TRIMS;
	return {
		trimStartMs,
		trimEndMs
	};
}
async function analyze$1(url) {
	const buffer = await fetchAndDecodeTrack(url);
	if (!buffer) return null;
	return scanSilenceEdges(buffer);
}
/**
* Kick off (or join) silence analysis for a track. Results are cached for the
* lifetime of the page; analyses run one at a time. Resolves to `null` when
* analysis is unavailable or unreliable — callers must fall back to the
* track's natural start/end.
*/
function ensureTrackAnalysis(track) {
	const key = trackKey(track);
	const url = getPrimaryTrackSource(track);
	if (!key || !url) return Promise.resolve(null);
	const existing = pending$1.get(key);
	if (existing) return existing;
	const job = lastJob$1.catch(() => {}).then(() => analyze$1(url)).then((trims) => {
		settled$1.set(key, trims);
		return trims;
	}, () => {
		settled$1.set(key, null);
		return null;
	});
	lastJob$1 = job;
	pending$1.set(key, job);
	return job;
}
/**
* Synchronous read of a finished analysis. Returns `null` while analysis is
* pending, failed, or was never requested.
*/
function getTrackTrims(track) {
	if (!track) return null;
	return settled$1.get(trackKey(track)) ?? null;
}
/**
* Seed the trims cache from another analysis pipeline. The Automix Pro
* orchestrator shares this module's decode and silence scan; seeding lets
* `getTrackTrims()` serve trims as soon as the scan finishes, long before the
* slower rhythm extraction settles, without a second download. Existing
* entries are never overwritten.
*/
function seedTrackTrims(key, trims) {
	if (!key || settled$1.has(key)) return;
	settled$1.set(key, trims);
}
//#endregion
//#region src/audio-player/automix/rhythmClient.ts
/**
* Main-thread client for the essentia rhythm worker.
*
* The worker (and with it the multi-megabyte essentia WASM chunk) is created
* lazily on the first analysis request. Any failure — construction, WASM
* init timeout, a hung job — latches `rhythmUnavailable` for the rest of the
* page so callers degrade to trims-only analysis instead of retrying forever.
*/
var INIT_TIMEOUT_MS = 2e4;
var JOB_TIMEOUT_MS = 3e4;
var worker = null;
var ready = null;
var unavailable = false;
var nextId = 1;
var inflight = /* @__PURE__ */ new Map();
function failEverything() {
	unavailable = true;
	for (const pending of inflight.values()) {
		clearTimeout(pending.timer);
		pending.resolve(null);
	}
	inflight.clear();
	try {
		worker?.terminate();
	} catch {}
	worker = null;
	ready = null;
}
function handleMessage(event) {
	const data = event.data;
	if (!data || typeof data !== "object" || !("id" in data)) return;
	const pending = inflight.get(data.id);
	if (!pending) return;
	inflight.delete(data.id);
	clearTimeout(pending.timer);
	if (data.ok) pending.resolve({
		bpm: data.bpm,
		ticksMs: data.ticksMs,
		confidenceRaw: data.confidence
	});
	else pending.resolve(null);
}
function ensureWorker() {
	if (unavailable) return Promise.resolve(false);
	if (ready) return ready;
	if (typeof Worker === "undefined") {
		unavailable = true;
		return Promise.resolve(false);
	}
	ready = new Promise((resolve) => {
		let instance;
		try {
			instance = new Worker(new URL(
				/* @vite-ignore */
				"/assets/rhythmWorker-CzRLqX0w.js",
				"" + import.meta.url
			), { type: "module" });
		} catch {
			unavailable = true;
			resolve(false);
			return;
		}
		const initTimer = setTimeout(() => {
			failEverything();
			resolve(false);
		}, INIT_TIMEOUT_MS);
		instance.addEventListener("message", (event) => {
			if (event.data && typeof event.data === "object" && "type" in event.data) {
				if (event.data.type === "ready") {
					clearTimeout(initTimer);
					resolve(true);
				}
				return;
			}
			handleMessage(event);
		});
		instance.addEventListener("error", () => {
			clearTimeout(initTimer);
			failEverything();
			resolve(false);
		});
		worker = instance;
	});
	return ready;
}
/**
* Run beat/BPM extraction on a mono 44.1kHz segment. `samples` is transferred
* to the worker and must not be reused afterwards. Resolves to `null` when
* rhythm analysis is unavailable or fails.
*/
async function analyzeRhythm(samples, sampleRate, offsetMs) {
	const ok = await ensureWorker();
	const target = worker;
	if (!ok || !target) return null;
	const id = nextId++;
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			inflight.delete(id);
			failEverything();
			resolve(null);
		}, JOB_TIMEOUT_MS);
		inflight.set(id, {
			resolve,
			timer
		});
		const request = {
			id,
			samples,
			sampleRate,
			offsetMs
		};
		try {
			target.postMessage(request, [samples.buffer]);
		} catch {
			clearTimeout(timer);
			inflight.delete(id);
			failEverything();
			resolve(null);
		}
	});
}
//#endregion
//#region src/audio-player/automix/analysisStore.ts
/**
* Best-effort IndexedDB persistence for Automix Pro analyses. Rhythm
* extraction costs a download, a decode, and seconds of WASM CPU while the
* result is ~1KB of JSON, so caching across page loads is a large win.
*
* Every operation swallows its errors and degrades to a miss/no-op: private
* browsing modes, quota pressure, or a missing IndexedDB simply behave like
* the in-memory-only world.
*/
var DB_NAME = "sap-automix";
var STORE_NAME = "analysis";
var dbPromise = null;
function openDb() {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve) => {
		if (typeof indexedDB === "undefined") return resolve(null);
		try {
			const request = indexedDB.open(DB_NAME, 1);
			request.onupgradeneeded = () => {
				try {
					request.result.createObjectStore(STORE_NAME);
				} catch {}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = (event) => {
				event.preventDefault();
				resolve(null);
			};
			request.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return dbPromise;
}
function storageKey(trackKey) {
	return `1:${trackKey}`;
}
async function readStoredAnalysis(trackKey) {
	const db = await openDb();
	if (!db) return null;
	return new Promise((resolve) => {
		try {
			const transaction = db.transaction(STORE_NAME, "readonly");
			transaction.onerror = (event) => event.preventDefault();
			const request = transaction.objectStore(STORE_NAME).get(storageKey(trackKey));
			request.onsuccess = () => {
				const value = request.result;
				resolve(value && typeof value === "object" ? value : null);
			};
			request.onerror = (event) => {
				event.preventDefault();
				resolve(null);
			};
		} catch {
			resolve(null);
		}
	});
}
async function writeStoredAnalysis(trackKey, analysis) {
	const db = await openDb();
	if (!db) return;
	try {
		const transaction = db.transaction(STORE_NAME, "readwrite");
		transaction.onerror = (event) => event.preventDefault();
		transaction.objectStore(STORE_NAME).put(analysis, storageKey(trackKey));
	} catch {}
}
//#endregion
//#region src/audio-player/automix/transitionPlanner.ts
/**
* Pure transition math for Automix Pro. No DOM, no Web Audio — everything
* here is deterministic and unit-tested. The orchestrator uses
* `computeTransitionPoints` to bake default transition points into a
* `TrackAnalysis`; `AutomixPlugin` calls `planTransition` at preload time to
* pick the actual fade length and timing for a specific track pair.
*/
/** RhythmExtractor2013 ("multifeature") reports confidence on a 0–5.32 scale. */
var RAW_CONFIDENCE_MAX = 5.32;
/** Below this normalized confidence a track's rhythm data is not trusted. */
var PRO_CONFIDENCE_MIN = .55;
/** BPM compatibility at/above this allows an extended beat-aware blend. */
var COMPAT_BLEND_MIN = .5;
/** Mean pair energy at/above this stretches the blend toward the maximum. */
var HIGH_ENERGY_MIN = .5;
/** Hard bounds for any Pro fade. */
var FADE_MIN_MS = 2500;
var FADE_MAX_MS = 12e3;
/** Extended blend range used for BPM-compatible, high-energy pairs. */
var LONG_BLEND_MIN_MS = 9e3;
/** Never start a fade closer than this to the trimmed end of the track. */
var FADE_END_SAFETY_MS = 2e3;
/** How far past the trim start an incoming track may wait for its first beat. */
var ENTRY_BEAT_WINDOW_MS = 2e3;
/** Beat interval assumed when a track has beats but no usable BPM. */
var DEFAULT_BEAT_INTERVAL_MS = 500;
/** Map RhythmExtractor2013's raw confidence (0–5.32) to 0..1. */
function normalizeRhythmConfidence(raw) {
	if (!Number.isFinite(raw) || raw <= 0) return 0;
	return Math.min(1, raw / RAW_CONFIDENCE_MAX);
}
/**
* Score how mixable two tempos are, 0..1. Considers half- and double-time
* relationships (85 vs 170 BPM scores 1). Score falls linearly from 1 at a
* perfect match to 0 at `tolerancePct` relative error.
*/
function bpmCompatibility(a, b, tolerancePct = 8) {
	if (!a || !b || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 0;
	const tolerance = tolerancePct / 100;
	let best = 0;
	for (const multiplier of [
		1,
		2,
		.5
	]) {
		const relativeError = Math.abs(a * multiplier - b) / b;
		const score = Math.max(0, 1 - relativeError / tolerance);
		if (score > best) best = score;
	}
	return best;
}
/**
* Return the beat nearest `targetMs`, or `targetMs` itself when no beat is
* within `maxDriftMs`.
*/
function snapToBeat(targetMs, beatsMs, maxDriftMs) {
	let best = targetMs;
	let bestDrift = Infinity;
	for (const beat of beatsMs) {
		const drift = Math.abs(beat - targetMs);
		if (drift < bestDrift) {
			bestDrift = drift;
			best = beat;
		}
	}
	return bestDrift <= maxDriftMs ? best : targetMs;
}
function beatIntervalMs(bpm) {
	if (!bpm || !Number.isFinite(bpm) || bpm <= 0) return DEFAULT_BEAT_INTERVAL_MS;
	return 6e4 / bpm;
}
/**
* Compute beat-snapped transition points for one track.
*
* `transitionOutMs` is where a crossfade of `fadeMs` should start so it ends
* at the trimmed end: snapped to the nearest beat (within one beat interval),
* but never later than `trimmedEnd − FADE_END_SAFETY_MS`. `transitionInMs` is
* the first beat shortly after the trim start, where an incoming deck lands
* on the grid instead of mid-beat.
*/
function computeTransitionPoints(analysis, trims, durationMs, fadeMs) {
	const beats = analysis.beats ?? [];
	const interval = beatIntervalMs(analysis.bpm);
	const trimmedEndMs = Math.max(0, durationMs - trims.trimEndMs);
	const latestStart = trimmedEndMs - FADE_END_SAFETY_MS;
	let transitionOutMs = snapToBeat(trimmedEndMs - fadeMs, beats, interval);
	transitionOutMs = Math.min(transitionOutMs, latestStart);
	transitionOutMs = Math.max(transitionOutMs, trims.trimStartMs);
	let transitionInMs = trims.trimStartMs;
	let firstBeatIn = Infinity;
	for (const beat of beats) if (beat >= trims.trimStartMs && beat < firstBeatIn) firstBeatIn = beat;
	if (firstBeatIn - trims.trimStartMs <= ENTRY_BEAT_WINDOW_MS) transitionInMs = firstBeatIn;
	return {
		transitionInMs,
		transitionOutMs
	};
}
function trimsOf(analysis) {
	return {
		trimStartMs: analysis?.trimStartMs ?? 0,
		trimEndMs: analysis?.trimEndMs ?? 0
	};
}
/**
* Decide fade length and timing for an outgoing/incoming pair.
*
* Policy: when both tracks carry trusted rhythm data, BPM-compatible
* high-energy pairs get a long beat-snapped blend (9–12s, scaled by energy),
* compatible low-energy pairs keep the base fade, and BPM-incompatible pairs
* get a short fade (2.5–3.5s) so the tempo clash stays brief. When either
* side's confidence is below `confidenceMin` the plan reproduces Automix
* Lite: base fade ending at the trimmed end, deck parked at the trim start.
*/
function planTransition(outgoing, incoming, durationAMs, baseFadeMs, confidenceMin = PRO_CONFIDENCE_MIN) {
	const trimsA = trimsOf(outgoing);
	const trimsB = trimsOf(incoming);
	const trimmedEndAMs = Math.max(0, durationAMs - trimsA.trimEndMs);
	const litePlan = {
		fadeMs: baseFadeMs,
		fadeStartMsInA: Math.max(trimmedEndAMs - baseFadeMs, 0),
		deckStartMsInB: trimsB.trimStartMs,
		usedPro: false
	};
	const confidenceA = outgoing?.confidence ?? 0;
	const confidenceB = incoming?.confidence ?? 0;
	if (!outgoing || !incoming || confidenceA < confidenceMin || confidenceB < confidenceMin) return litePlan;
	const compatibility = bpmCompatibility(outgoing.bpm, incoming.bpm);
	const meanEnergy = ((outgoing.energy ?? .5) + (incoming.energy ?? .5)) / 2;
	let fadeMs;
	if (compatibility >= COMPAT_BLEND_MIN) if (meanEnergy >= HIGH_ENERGY_MIN) {
		const lift = Math.min(1, (meanEnergy - HIGH_ENERGY_MIN) / (1 - HIGH_ENERGY_MIN));
		fadeMs = Math.round(LONG_BLEND_MIN_MS + (FADE_MAX_MS - LONG_BLEND_MIN_MS) * lift);
	} else fadeMs = baseFadeMs;
	else fadeMs = Math.round(FADE_MIN_MS + 1e3 * (compatibility / COMPAT_BLEND_MIN));
	const availableMs = trimmedEndAMs - trimsA.trimStartMs;
	const maxFadeMs = Math.max(FADE_MIN_MS, Math.min(FADE_MAX_MS, availableMs - FADE_END_SAFETY_MS));
	fadeMs = Math.min(maxFadeMs, Math.max(FADE_MIN_MS, fadeMs));
	const pointsA = computeTransitionPoints(outgoing, trimsA, durationAMs, fadeMs);
	const deckStartMsInB = incoming.transitionInMs ?? trimsB.trimStartMs;
	return {
		fadeMs,
		fadeStartMsInA: pointsA.transitionOutMs,
		deckStartMsInB,
		usedPro: true
	};
}
//#endregion
//#region src/audio-player/automix/trackAnalysis.ts
/**
* Automix Pro track analysis orchestrator.
*
* One download + decode per track feeds everything: silence trims (same scan
* as Automix Lite), an energy estimate, and beat/BPM extraction in the
* essentia worker. Results are cached in memory for the page (same
* pending/settled/serializer pattern as the Lite analysis) and persisted to
* IndexedDB when the rhythm data is trustworthy.
*
* Rhythm is only extracted from two windows — the first ~60s after the trim
* start and the last ~120s before the trimmed end — because transitions only
* need beats near the edges, and a full-length track would be a multi-hundred
* megabyte Float32 transfer on long files.
*/
/** Target sample rate for rhythm extraction; RhythmExtractor2013 assumes it. */
var RHYTHM_SAMPLE_RATE = 44100;
var HEAD_SEGMENT_MS = 6e4;
var TAIL_SEGMENT_MS = 12e4;
/** Tracks whose trimmed length fits in this analyze as a single segment. */
var SINGLE_SEGMENT_MAX_MS = 18e4;
/** RMS window for the energy estimate, matching the silence scan. */
var ENERGY_WINDOW_MS = 50;
/** Window RMS treated as "full" energy when mapping to 0..1. */
var ENERGY_FULL_SCALE_RMS = .35;
/** Penalty applied when head and tail disagree about the tempo. */
var SEGMENT_DISAGREEMENT_PENALTY = .7;
/** Fade length used to bake default transition points into the analysis. */
var DEFAULT_FADE_MS = 5500;
var rhythmFn = analyzeRhythm;
var decodeFn = fetchAndDecodeTrack;
var persist = true;
var pending = /* @__PURE__ */ new Map();
var settled = /* @__PURE__ */ new Map();
var lastJob = Promise.resolve();
/**
* Downmix a region of the decoded buffer to mono and linearly resample it to
* 44.1kHz. Plain JS instead of OfflineAudioContext rendering so the result is
* deterministic and testable; linear interpolation is plenty for beat
* tracking.
*/
function extractMonoSegment(buffer, startMs, endMs) {
	const sourceRate = buffer.sampleRate;
	const start = Math.max(0, Math.floor(startMs / 1e3 * sourceRate));
	const end = Math.min(buffer.length, Math.ceil(endMs / 1e3 * sourceRate));
	if (end - start < sourceRate) return null;
	const channels = [];
	for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
	if (channels.length === 0) return null;
	const ratio = sourceRate / RHYTHM_SAMPLE_RATE;
	const outLength = Math.floor((end - start) / ratio);
	const out = new Float32Array(outLength);
	for (let i = 0; i < outLength; i++) {
		const sourcePos = start + i * ratio;
		const i0 = Math.min(end - 1, Math.floor(sourcePos));
		const i1 = Math.min(end - 1, i0 + 1);
		const frac = sourcePos - i0;
		let sum = 0;
		for (const data of channels) sum += data[i0] + (data[i1] - data[i0]) * frac;
		out[i] = sum / channels.length;
	}
	return out;
}
/** Mean windowed RMS over the trimmed region, mapped to 0..1. */
function computeEnergy(buffer, trims) {
	const win = Math.max(1, Math.round(ENERGY_WINDOW_MS / 1e3 * buffer.sampleRate));
	const start = Math.floor(trims.trimStartMs / 1e3 * buffer.sampleRate);
	const end = buffer.length - Math.floor(trims.trimEndMs / 1e3 * buffer.sampleRate);
	const channels = [];
	for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) channels.push(buffer.getChannelData(c));
	if (channels.length === 0 || end - start < win) return 0;
	let total = 0;
	let windows = 0;
	for (let pos = start; pos + win <= end; pos += win) {
		let loudest = 0;
		for (const data of channels) {
			let sum = 0;
			for (let i = pos; i < pos + win; i++) {
				const v = data[i];
				sum += v * v;
			}
			const rms = Math.sqrt(sum / win);
			if (rms > loudest) loudest = rms;
		}
		total += loudest;
		windows++;
	}
	if (windows === 0) return 0;
	return Math.min(1, total / windows / ENERGY_FULL_SCALE_RMS);
}
function mergeSegments(head, tail) {
	if (!head && !tail) return { confidence: 0 };
	if (!head || !tail) {
		const only = head ?? tail;
		return {
			bpm: only.bpm,
			beats: only.ticksMs,
			confidence: normalizeRhythmConfidence(only.confidenceRaw) * SEGMENT_DISAGREEMENT_PENALTY
		};
	}
	const beats = [...head.ticksMs, ...tail.ticksMs].sort((a, b) => a - b);
	const agreement = bpmCompatibility(head.bpm, tail.bpm);
	const confidence = Math.min(normalizeRhythmConfidence(head.confidenceRaw), normalizeRhythmConfidence(tail.confidenceRaw));
	if (agreement >= .5) return {
		bpm: Math.abs(head.bpm - tail.bpm) / tail.bpm <= .08 ? (head.bpm + tail.bpm) / 2 : tail.bpm,
		beats,
		confidence
	};
	return {
		bpm: tail.bpm,
		beats,
		confidence: confidence * SEGMENT_DISAGREEMENT_PENALTY
	};
}
async function analyze(key, url) {
	if (persist) {
		const stored = await readStoredAnalysis(key);
		if (stored) {
			seedTrackTrims(key, {
				trimStartMs: stored.trimStartMs ?? 0,
				trimEndMs: stored.trimEndMs ?? 0
			});
			return stored;
		}
	}
	const buffer = await decodeFn(url);
	if (!buffer) return null;
	const trims = scanSilenceEdges(buffer);
	seedTrackTrims(key, trims);
	const energy = computeEnergy(buffer, trims);
	const durationMs = buffer.duration * 1e3;
	const trimmedEndMs = durationMs - trims.trimEndMs;
	const trimmedLengthMs = trimmedEndMs - trims.trimStartMs;
	let rhythm;
	if (trimmedLengthMs <= SINGLE_SEGMENT_MAX_MS) {
		const samples = extractMonoSegment(buffer, trims.trimStartMs, trimmedEndMs);
		const result = samples ? await rhythmFn(samples, RHYTHM_SAMPLE_RATE, trims.trimStartMs) : null;
		rhythm = result ? {
			bpm: result.bpm,
			beats: result.ticksMs,
			confidence: normalizeRhythmConfidence(result.confidenceRaw)
		} : { confidence: 0 };
	} else {
		const headEndMs = trims.trimStartMs + HEAD_SEGMENT_MS;
		const tailStartMs = trimmedEndMs - TAIL_SEGMENT_MS;
		const headSamples = extractMonoSegment(buffer, trims.trimStartMs, headEndMs);
		const tailSamples = extractMonoSegment(buffer, tailStartMs, trimmedEndMs);
		const [head, tail] = await Promise.all([headSamples ? rhythmFn(headSamples, RHYTHM_SAMPLE_RATE, trims.trimStartMs) : null, tailSamples ? rhythmFn(tailSamples, RHYTHM_SAMPLE_RATE, tailStartMs) : null]);
		rhythm = mergeSegments(head, tail);
	}
	const analysis = {
		trimStartMs: trims.trimStartMs,
		trimEndMs: trims.trimEndMs,
		energy,
		confidence: rhythm.confidence
	};
	if (rhythm.bpm !== void 0 && rhythm.confidence > 0) {
		analysis.bpm = rhythm.bpm;
		analysis.beats = rhythm.beats;
		const points = computeTransitionPoints(analysis, trims, durationMs, DEFAULT_FADE_MS);
		analysis.transitionInMs = points.transitionInMs;
		analysis.transitionOutMs = points.transitionOutMs;
	} else {
		analysis.transitionInMs = trims.trimStartMs;
		analysis.transitionOutMs = Math.max(trims.trimStartMs, trimmedEndMs - DEFAULT_FADE_MS);
	}
	if (persist && rhythm.confidence > 0) writeStoredAnalysis(key, analysis);
	return analysis;
}
/**
* Kick off (or join) Automix Pro analysis for a track. Results are cached for
* the lifetime of the page and persisted to IndexedDB when rhythm extraction
* succeeded; analyses run one at a time. Resolves to `null` when analysis is
* entirely unavailable — callers fall back to Automix Lite behavior.
*/
function ensureProTrackAnalysis(track) {
	const key = trackKey(track);
	const url = getPrimaryTrackSource(track);
	if (!key || !url) return Promise.resolve(null);
	const existing = pending.get(key);
	if (existing) return existing;
	const job = lastJob.catch(() => {}).then(() => analyze(key, url)).then((analysis) => {
		settled.set(key, analysis);
		return analysis;
	}, () => {
		settled.set(key, null);
		return null;
	});
	lastJob = job;
	pending.set(key, job);
	return job;
}
/**
* Synchronous read of a finished Pro analysis. Returns `null` while analysis
* is pending, failed, or was never requested.
*/
function getTrackAnalysis(track) {
	if (!track) return null;
	return settled.get(trackKey(track)) ?? null;
}
//#endregion
//#region node_modules/zod/v4/core/core.js
var _a$1;
function $constructor(name, initializer, params) {
	function init(inst, def) {
		if (!inst._zod) Object.defineProperty(inst, "_zod", {
			value: {
				def,
				constr: _,
				traits: /* @__PURE__ */ new Set()
			},
			enumerable: false
		});
		if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		const proto = _.prototype;
		const keys = Object.keys(proto);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		var _a;
		const inst = params?.Parent ? new Definition() : this;
		init(inst, def);
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		for (const fn of inst._zod.deferred) fn();
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
//#endregion
//#region node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
function cached(getter) {
	return { get value() {
		{
			const value = getter();
			Object.defineProperty(this, "value", { value });
			return value;
		}
		throw new Error("cached value already set");
	} };
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
var EVALUATING = /* @__PURE__*/ Symbol("evaluating");
function defineLazy(object, key, getter) {
	let value = void 0;
	Object.defineProperty(object, key, {
		get() {
			if (value === EVALUATING) return;
			if (value === void 0) {
				value = EVALUATING;
				value = getter();
			}
			return value;
		},
		set(v) {
			Object.defineProperty(object, key, { value: v });
		},
		configurable: true
	});
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) Object.assign(mergedDescriptors, Object.getOwnPropertyDescriptors(def));
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
var propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
	});
}
var NUMBER_FORMAT_RANGES = {
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = {};
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				newShape[key] = currDef.shape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = { ...schema._zod.def.shape };
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				delete newShape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = schema._zod.def.shape;
		for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function merge(a, b) {
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	return clone(a, mergeDefs(a._zod.def, {
		get shape() {
			const _shape = {
				...a._zod.def.shape,
				...b._zod.def.shape
			};
			assignProp(this, "shape", _shape);
			return _shape;
		},
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask) {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const oldShape = schema._zod.def.shape;
			const shape = { ...oldShape };
			if (mask) for (const key in mask) {
				if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				shape[key] = Class ? new Class({
					type: "optional",
					innerType: oldShape[key]
				}) : oldShape[key];
			}
			else for (const key in oldShape) shape[key] = Class ? new Class({
				type: "optional",
				innerType: oldShape[key]
			}) : oldShape[key];
			assignProp(this, "shape", shape);
			return shape;
		},
		checks: []
	}));
}
function required(Class, schema, mask) {
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const oldShape = schema._zod.def.shape;
		const shape = { ...oldShape };
		if (mask) for (const key in mask) {
			if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
			if (!mask[key]) continue;
			shape[key] = new Class({
				type: "nonoptional",
				innerType: oldShape[key]
			});
		}
		else for (const key in oldShape) shape[key] = new Class({
			type: "nonoptional",
			innerType: oldShape[key]
		});
		assignProp(this, "shape", shape);
		return shape;
	} }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
	rest.path ?? (rest.path = []);
	rest.message = message;
	if (ctx?.reportInput) rest.input = _input;
	return rest;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
//#endregion
//#region node_modules/zod/v4/core/errors.js
var initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	Object.defineProperty(inst, "_zod", {
		value: inst._zod,
		enumerable: false
	});
	Object.defineProperty(inst, "issues", {
		value: def,
		enumerable: false
	});
	inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
	Object.defineProperty(inst, "toString", {
		value: () => inst.message,
		enumerable: false
	});
};
var $ZodError = $constructor("$ZodError", initializer$1);
var $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) {
		fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
		fieldErrors[sub.path[0]].push(mapper(sub));
	} else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
					else {
						curr[el] = curr[el] || { _errors: [] };
						curr[el]._errors.push(mapper(issue));
					}
					curr = curr[el];
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
//#endregion
//#region node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	if (result.issues.length) {
		const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, _params?.callee);
		throw e;
	}
	return result.value;
};
var _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	if (result.issues.length) {
		const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, params?.callee);
		throw e;
	}
	return result.value;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? {
		success: false,
		error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
var safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? {
		success: false,
		error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
var safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
var _encode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parse(_Err)(schema, value, ctx);
};
var _decode = (_Err) => (schema, value, _ctx) => {
	return _parse(_Err)(schema, value, _ctx);
};
var _encodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parseAsync(_Err)(schema, value, ctx);
};
var _decodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _parseAsync(_Err)(schema, value, _ctx);
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
//#endregion
//#region node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
var duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
var uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
var email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^[A-Za-z0-9_-]*$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
var date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time$1(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
	const time = timeSource({ precision: args.precision });
	const opts = ["Z"];
	if (args.local) opts.push("");
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const timeRegex = `${time}(?:${opts.join("|")})`;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var string$1 = (params) => {
	const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
	return new RegExp(`^${regex}$`);
};
var integer = /^-?\d+$/;
var number$1 = /^-?\d+(?:\.\d+)?$/;
var boolean$1 = /^(?:true|false)$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;
//#endregion
//#region node_modules/zod/v4/core/checks.js
var $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
var numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
var $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
		if (def.value < curr) if (def.inclusive) bag.maximum = def.value;
		else bag.exclusiveMaximum = def.value;
	});
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
		if (def.value > curr) if (def.inclusive) bag.minimum = def.value;
		else bag.exclusiveMinimum = def.value;
	});
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		var _a;
		(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
	});
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		bag.minimum = minimum;
		bag.maximum = maximum;
		if (isInt) bag.pattern = integer;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
		if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
		if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.minimum = def.length;
		bag.maximum = def.length;
		bag.length = def.length;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		const length = input.length;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		if (def.pattern) {
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(def.pattern);
		}
	});
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
var $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
	def.pattern = pattern;
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
//#endregion
//#region node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = []) {
		this.content = [];
		this.indent = 0;
		if (this) this.args = args;
	}
	indented(fn) {
		this.indent += 1;
		fn(this);
		this.indent -= 1;
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const args = this?.args;
		const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
		return new F(...args, lines.join("\n"));
	}
};
//#endregion
//#region node_modules/zod/v4/core/versions.js
var version = {
	major: 4,
	minor: 4,
	patch: 3
};
//#endregion
//#region node_modules/zod/v4/core/schemas.js
var $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const checks = [...inst._zod.def.checks ?? []];
	if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
	defineLazy(inst, "~standard", () => ({
		validate: (value) => {
			try {
				const r = safeParse$1(inst, value);
				return r.success ? { value: r.data } : { issues: r.error?.issues };
			} catch (_) {
				return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
			}
		},
		vendor: "zod",
		version: 1
	}));
});
var $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
var $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
var $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
var $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
var $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
var $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			if (!def.normalize && def.protocol?.source === httpProtocol.source) {
				if (!/^https?:\/\//i.test(trimmed)) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid URL format",
						input: payload.value,
						inst,
						continue: !def.abort
					});
					return;
				}
			}
			const url = new URL(trimmed);
			if (def.hostname) {
				def.hostname.lastIndex = 0;
				if (!def.hostname.test(url.hostname)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid hostname",
					pattern: def.hostname.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.protocol) {
				def.protocol.lastIndex = 0;
				if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid protocol",
					pattern: def.protocol.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.normalize) payload.value = url.href;
			else payload.value = trimmed;
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
var $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	def.pattern ?? (def.pattern = nanoid);
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
var $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
var $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime$1(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date$1);
	$ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time$1(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration$1);
	$ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv4`;
});
var $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv6`;
	inst._zod.check = (payload) => {
		try {
			new URL(`http://[${payload.value}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "ipv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
var $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
var $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		const parts = payload.value.split("/");
		try {
			if (parts.length !== 2) throw new Error();
			const [address, prefix] = parts;
			if (!prefix) throw new Error();
			const prefixNum = Number(prefix);
			if (`${prefixNum}` !== prefix) throw new Error();
			if (prefixNum < 0 || prefixNum > 128) throw new Error();
			new URL(`http://[${address}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "cidrv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
var $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64";
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64URL(data) {
	if (!base64url.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
var $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64url);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64url";
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
var $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
var $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
var $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
var $ZodAny = /*@__PURE__*/ $constructor("$ZodAny", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
var $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
var $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
var $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = Array(input.length);
		const proms = [];
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else handleArrayResult(result, payload, i);
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
	const isPresent = key in input;
	if (result.issues.length) {
		if (isOptionalIn && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && !isOptionalIn) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		keys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const isOptionalIn = _catchall.optin === "optional";
	const isOptionalOut = _catchall.optout === "optional";
	for (const key in input) {
		if (key === "__proto__") continue;
		if (keySet.has(key)) continue;
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
		else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
var $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
		const sh = def.shape;
		Object.defineProperty(def, "shape", { get: () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			return newSh;
		} });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazy(inst._zod, "propValues", () => {
		const shape = def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = {};
		const proms = [];
		const shape = value.shape;
		for (const key of value.keys) {
			const el = shape[key];
			const isOptionalIn = el._zod.optin === "optional";
			const isOptionalOut = el._zod.optout === "optional";
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
			else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
	};
});
var $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const generateFastpass = (shape) => {
		const doc = new Doc([
			"shape",
			"payload",
			"ctx"
		]);
		const normalized = _normalized.value;
		const parseStr = (key) => {
			const k = esc(key);
			return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		};
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.keys) ids[key] = `key_${counter++}`;
		doc.write(`const newResult = {};`);
		for (const key of normalized.keys) {
			const id = ids[key];
			const k = esc(key);
			const schema = shape[key];
			const isOptionalIn = schema?._zod?.optin === "optional";
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(key)};`);
			if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
			else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		const fn = doc.compile();
		return (payload, ctx) => fn(shape, payload, ctx);
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
var $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "values", () => {
		if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazy(inst._zod, "pattern", () => {
		if (def.options.every((o) => o._zod.pattern)) {
			const patterns = def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
var $ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
	def.inclusive = false;
	$ZodUnion.init(inst, def);
	const _super = inst._zod.parse;
	defineLazy(inst._zod, "propValues", () => {
		const propValues = {};
		for (const option of def.options) {
			const pv = option._zod.propValues;
			if (!pv || Object.keys(pv).length === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
			for (const [k, v] of Object.entries(pv)) {
				if (!propValues[k]) propValues[k] = /* @__PURE__ */ new Set();
				for (const val of v) propValues[k].add(val);
			}
		}
		return propValues;
	});
	const disc = cached(() => {
		const opts = def.options;
		const map = /* @__PURE__ */ new Map();
		for (const o of opts) {
			const values = o._zod.propValues?.[def.discriminator];
			if (!values || values.size === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
			for (const v of values) {
				if (map.has(v)) throw new Error(`Duplicate discriminator value "${String(v)}"`);
				map.set(v, o);
			}
		}
		return map;
	});
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isObject(input)) {
			payload.issues.push({
				code: "invalid_type",
				expected: "object",
				input,
				inst
			});
			return payload;
		}
		const opt = disc.value.get(input?.[def.discriminator]);
		if (opt) return opt._zod.run(payload, ctx);
		if (def.unionFallback || ctx.direction === "backward") return _super(payload, ctx);
		payload.issues.push({
			code: "invalid_union",
			errors: [],
			note: "No matching discriminator",
			discriminator: def.discriminator,
			options: Array.from(disc.value.keys()),
			input,
			path: [def.discriminator],
			inst
		});
		return payload;
	};
});
var $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		for (const key of sharedKeys) {
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
		unrecIssue ?? (unrecIssue = iss);
		for (const k of iss.keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k).l = true;
		}
	} else result.issues.push(iss);
	for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
		if (!unrecKeys.has(k)) unrecKeys.set(k, {});
		unrecKeys.get(k).r = true;
	}
	else result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length && unrecIssue) result.issues.push({
		...unrecIssue,
		keys: bothKeys
	});
	if (aborted(result)) return result;
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	result.value = merged.data;
	return result;
}
var $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values) {
			payload.value = {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) {
				unrecognized = unrecognized ?? [];
				unrecognized.push(key);
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized
			});
		} else {
			payload.value = {};
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
var $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
	$ZodType.init(inst, def);
	if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
	const values = new Set(def.values);
	inst._zod.values = values;
	inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (values.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values: def.values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			payload.fallback = true;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		payload.fallback = true;
		return payload;
	};
});
function handleOptionalResult(result, input) {
	if (input === void 0 && (result.issues.length || result.fallback)) return {
		issues: [],
		value: void 0
	};
	return result;
}
var $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.optout = "optional";
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? new Set([...def.innerType._zod.values, void 0]) : void 0;
	});
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (def.innerType._zod.optin === "optional") {
			const input = payload.value;
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
			return handleOptionalResult(result, input);
		}
		if (payload.value === void 0) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
var $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => {
		const v = def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
var $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => {
			payload.value = result.value;
			if (result.issues.length) {
				payload.value = def.catchValue({
					...payload,
					error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
					input: payload.value
				});
				payload.issues = [];
				payload.fallback = true;
			}
			return payload;
		});
		payload.value = result.value;
		if (result.issues.length) {
			payload.value = def.catchValue({
				...payload,
				error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
				input: payload.value
			});
			payload.issues = [];
			payload.fallback = true;
		}
		return payload;
	};
});
var $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => def.in._zod.values);
	defineLazy(inst._zod, "optin", () => def.in._zod.optin);
	defineLazy(inst._zod, "optout", () => def.out._zod.optout);
	defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.length) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues,
		fallback: left.fallback
	}, ctx);
}
var $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
	defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	payload.value = Object.freeze(payload.value);
	return payload;
}
var $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
//#endregion
//#region node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;
//#endregion
//#region node_modules/zod/v4/core/api.js
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class({
		type: "string",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
	return new Class({
		type: "number",
		checks: [],
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _any(Class) {
	return new Class({ type: "any" });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _custom(Class, fn, _params) {
	const norm = normalizeParams(_params);
	norm.abort ?? (norm.abort = true);
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...norm
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
//#endregion
//#region node_modules/zod/v4/core/to-json-schema.js
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		external: params?.external ?? void 0
	};
}
function process$1(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			process$1(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) Object.assign(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
			};
		}
		if (entry[1] === root) return { ref: "#" };
		const defUriPrefix = `#/${defsSegment}/`;
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + defId
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") {
				extractToDef(entry);
				continue;
			}
		}
	}
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else Object.assign(schema, refSchema);
			Object.assign(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	Object.assign(result, root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			defs[seen.defId] = seen.def;
		}
	}
	if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
	else result.definitions = defs;
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	process$1(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	process$1(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
//#endregion
//#region node_modules/zod/v4/core/json-schema-processors.js
var formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
var stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time") delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const regexes = [...patterns];
		if (regexes.length === 1) json.pattern = regexes[0].source;
		else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
var numberProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
	if (typeof format === "string" && format.includes("int")) json.type = "integer";
	else json.type = "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) if (legacy) {
		json.minimum = exclusiveMinimum;
		json.exclusiveMinimum = true;
	} else json.exclusiveMinimum = exclusiveMinimum;
	else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) if (legacy) {
		json.maximum = exclusiveMaximum;
		json.exclusiveMaximum = true;
	} else json.exclusiveMaximum = exclusiveMaximum;
	else if (typeof maximum === "number") json.maximum = maximum;
	if (typeof multipleOf === "number") json.multipleOf = multipleOf;
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
var neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
var enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
var literalProcessor = (schema, ctx, json, _params) => {
	const def = schema._zod.def;
	const vals = [];
	for (const val of def.values) if (val === void 0) {
		if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
	} else if (typeof val === "bigint") if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
	else vals.push(Number(val));
	else vals.push(val);
	if (vals.length === 0) {} else if (vals.length === 1) {
		const val = vals[0];
		json.type = val === null ? "null" : typeof val;
		if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
		else json.const = val;
	} else {
		if (vals.every((v) => typeof v === "number")) json.type = "number";
		if (vals.every((v) => typeof v === "string")) json.type = "string";
		if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
		if (vals.every((v) => v === null)) json.type = "null";
		json.enum = vals;
	}
};
var customProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
};
var transformProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = schema._zod.bag;
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = process$1(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
var objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	json.properties = {};
	const shape = def.shape;
	for (const key in shape) json.properties[key] = process$1(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	});
	const allKeys = new Set(Object.keys(shape));
	const requiredKeys = new Set([...allKeys].filter((key) => {
		const v = def.shape[key]._zod;
		if (ctx.io === "input") return v.optin === void 0;
		else return v.optout === void 0;
	}));
	if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = process$1(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
var unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => process$1(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
var intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = process$1(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = process$1(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
};
var recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = keyType._zod.bag?.patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = process$1(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) json.patternProperties[pattern.source] = valueSchema;
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") json.propertyNames = process$1(def.keyType, ctx, {
			...params,
			path: [...params.path, "propertyNames"]
		});
		json.additionalProperties = process$1(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	if (keyValues) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues;
	}
};
var nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
var defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
var prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
var catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		throw new Error("Dynamic catch values are not supported in JSON Schema");
	}
	json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	process$1(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
var optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
//#endregion
//#region node_modules/zod/v4/classic/iso.js
var ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function datetime(params) {
	return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
var ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function date(params) {
	return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
var ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function time(params) {
	return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
var ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function duration(params) {
	return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
//#endregion
//#region node_modules/zod/v4/classic/errors.js
var initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	Object.defineProperties(inst, {
		format: { value: (mapper) => formatError(inst, mapper) },
		flatten: { value: (mapper) => flattenError(inst, mapper) },
		addIssue: { value: (issue) => {
			inst.issues.push(issue);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		addIssues: { value: (issues) => {
			inst.issues.push(...issues);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		isEmpty: { get() {
			return inst.issues.length === 0;
		} }
	});
};
var ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
//#endregion
//#region node_modules/zod/v4/classic/parse.js
var parse = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
//#endregion
//#region node_modules/zod/v4/classic/schemas.js
var _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
	const proto = Object.getPrototypeOf(inst);
	let installed = _installedGroups.get(proto);
	if (!installed) {
		installed = /* @__PURE__ */ new Set();
		_installedGroups.set(proto, installed);
	}
	if (installed.has(group)) return;
	installed.add(group);
	for (const key in methods) {
		const fn = methods[key];
		Object.defineProperty(proto, key, {
			configurable: true,
			enumerable: false,
			get() {
				const bound = fn.bind(this);
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: bound
				});
				return bound;
			},
			set(v) {
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: v
				});
			}
		});
	}
}
var ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	$ZodType.init(inst, def);
	Object.assign(inst["~standard"], { jsonSchema: {
		input: createStandardJSONSchemaMethod(inst, "input"),
		output: createStandardJSONSchemaMethod(inst, "output")
	} });
	inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
	inst.def = def;
	inst.type = def.type;
	Object.defineProperty(inst, "_def", { value: def });
	inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
	inst.safeParse = (data, params) => safeParse(inst, data, params);
	inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
	inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
	inst.spa = inst.safeParseAsync;
	inst.encode = (data, params) => encode(inst, data, params);
	inst.decode = (data, params) => decode(inst, data, params);
	inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
	inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
	inst.safeEncode = (data, params) => safeEncode(inst, data, params);
	inst.safeDecode = (data, params) => safeDecode(inst, data, params);
	inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
	inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
	_installLazyMethods(inst, "ZodType", {
		check(...chks) {
			const def = this.def;
			return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
				check: ch,
				def: { check: "custom" },
				onattach: []
			} } : ch)] }), { parent: true });
		},
		with(...chks) {
			return this.check(...chks);
		},
		clone(def, params) {
			return clone(this, def, params);
		},
		brand() {
			return this;
		},
		register(reg, meta) {
			reg.add(this, meta);
			return this;
		},
		refine(check, params) {
			return this.check(refine(check, params));
		},
		superRefine(refinement, params) {
			return this.check(superRefine(refinement, params));
		},
		overwrite(fn) {
			return this.check(/* @__PURE__ */ _overwrite(fn));
		},
		optional() {
			return optional(this);
		},
		exactOptional() {
			return exactOptional(this);
		},
		nullable() {
			return nullable(this);
		},
		nullish() {
			return optional(nullable(this));
		},
		nonoptional(params) {
			return nonoptional(this, params);
		},
		array() {
			return array(this);
		},
		or(arg) {
			return union([this, arg]);
		},
		and(arg) {
			return intersection(this, arg);
		},
		transform(tx) {
			return pipe(this, transform(tx));
		},
		default(d) {
			return _default(this, d);
		},
		prefault(d) {
			return prefault(this, d);
		},
		catch(params) {
			return _catch(this, params);
		},
		pipe(target) {
			return pipe(this, target);
		},
		readonly() {
			return readonly(this);
		},
		describe(description) {
			const cl = this.clone();
			globalRegistry.add(cl, { description });
			return cl;
		},
		meta(...args) {
			if (args.length === 0) return globalRegistry.get(this);
			const cl = this.clone();
			globalRegistry.add(cl, args[0]);
			return cl;
		},
		isOptional() {
			return this.safeParse(void 0).success;
		},
		isNullable() {
			return this.safeParse(null).success;
		},
		apply(fn) {
			return fn(this);
		}
	});
	Object.defineProperty(inst, "description", {
		get() {
			return globalRegistry.get(inst)?.description;
		},
		configurable: true
	});
	return inst;
});
/** @internal */
var _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
	const bag = inst._zod.bag;
	inst.format = bag.format ?? null;
	inst.minLength = bag.minimum ?? null;
	inst.maxLength = bag.maximum ?? null;
	_installLazyMethods(inst, "_ZodString", {
		regex(...args) {
			return this.check(/* @__PURE__ */ _regex(...args));
		},
		includes(...args) {
			return this.check(/* @__PURE__ */ _includes(...args));
		},
		startsWith(...args) {
			return this.check(/* @__PURE__ */ _startsWith(...args));
		},
		endsWith(...args) {
			return this.check(/* @__PURE__ */ _endsWith(...args));
		},
		min(...args) {
			return this.check(/* @__PURE__ */ _minLength(...args));
		},
		max(...args) {
			return this.check(/* @__PURE__ */ _maxLength(...args));
		},
		length(...args) {
			return this.check(/* @__PURE__ */ _length(...args));
		},
		nonempty(...args) {
			return this.check(/* @__PURE__ */ _minLength(1, ...args));
		},
		lowercase(params) {
			return this.check(/* @__PURE__ */ _lowercase(params));
		},
		uppercase(params) {
			return this.check(/* @__PURE__ */ _uppercase(params));
		},
		trim() {
			return this.check(/* @__PURE__ */ _trim());
		},
		normalize(...args) {
			return this.check(/* @__PURE__ */ _normalize(...args));
		},
		toLowerCase() {
			return this.check(/* @__PURE__ */ _toLowerCase());
		},
		toUpperCase() {
			return this.check(/* @__PURE__ */ _toUpperCase());
		},
		slugify() {
			return this.check(/* @__PURE__ */ _slugify());
		}
	});
});
var ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
	inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
	inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
	inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
	inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
	inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
	inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
	inst.datetime = (params) => inst.check(datetime(params));
	inst.date = (params) => inst.check(date(params));
	inst.time = (params) => inst.check(time(params));
	inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
var ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
var ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	_installLazyMethods(inst, "ZodNumber", {
		gt(value, params) {
			return this.check(/* @__PURE__ */ _gt(value, params));
		},
		gte(value, params) {
			return this.check(/* @__PURE__ */ _gte(value, params));
		},
		min(value, params) {
			return this.check(/* @__PURE__ */ _gte(value, params));
		},
		lt(value, params) {
			return this.check(/* @__PURE__ */ _lt(value, params));
		},
		lte(value, params) {
			return this.check(/* @__PURE__ */ _lte(value, params));
		},
		max(value, params) {
			return this.check(/* @__PURE__ */ _lte(value, params));
		},
		int(params) {
			return this.check(int(params));
		},
		safe(params) {
			return this.check(int(params));
		},
		positive(params) {
			return this.check(/* @__PURE__ */ _gt(0, params));
		},
		nonnegative(params) {
			return this.check(/* @__PURE__ */ _gte(0, params));
		},
		negative(params) {
			return this.check(/* @__PURE__ */ _lt(0, params));
		},
		nonpositive(params) {
			return this.check(/* @__PURE__ */ _lte(0, params));
		},
		multipleOf(value, params) {
			return this.check(/* @__PURE__ */ _multipleOf(value, params));
		},
		step(value, params) {
			return this.check(/* @__PURE__ */ _multipleOf(value, params));
		},
		finite() {
			return this;
		}
	});
	const bag = inst._zod.bag;
	inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
	inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
	inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
	inst.isFinite = true;
	inst.format = bag.format ?? null;
});
function number(params) {
	return /* @__PURE__ */ _number(ZodNumber, params);
}
var ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
var ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
var ZodAny = /*@__PURE__*/ $constructor("ZodAny", (inst, def) => {
	$ZodAny.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function any() {
	return /* @__PURE__ */ _any(ZodAny);
}
var ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
var ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
var ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
	_installLazyMethods(inst, "ZodArray", {
		min(n, params) {
			return this.check(/* @__PURE__ */ _minLength(n, params));
		},
		nonempty(params) {
			return this.check(/* @__PURE__ */ _minLength(1, params));
		},
		max(n, params) {
			return this.check(/* @__PURE__ */ _maxLength(n, params));
		},
		length(n, params) {
			return this.check(/* @__PURE__ */ _length(n, params));
		},
		unwrap() {
			return this.element;
		}
	});
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
var ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	defineLazy(inst, "shape", () => {
		return def.shape;
	});
	_installLazyMethods(inst, "ZodObject", {
		keyof() {
			return _enum(Object.keys(this._zod.def.shape));
		},
		catchall(catchall) {
			return this.clone({
				...this._zod.def,
				catchall
			});
		},
		passthrough() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		loose() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		strict() {
			return this.clone({
				...this._zod.def,
				catchall: never()
			});
		},
		strip() {
			return this.clone({
				...this._zod.def,
				catchall: void 0
			});
		},
		extend(incoming) {
			return extend(this, incoming);
		},
		safeExtend(incoming) {
			return safeExtend(this, incoming);
		},
		merge(other) {
			return merge(this, other);
		},
		pick(mask) {
			return pick(this, mask);
		},
		omit(mask) {
			return omit(this, mask);
		},
		partial(...args) {
			return partial(ZodOptional, this, args[0]);
		},
		required(...args) {
			return required(ZodNonOptional, this, args[0]);
		}
	});
});
function object(shape, params) {
	return new ZodObject({
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	});
}
var ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
var ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("ZodDiscriminatedUnion", (inst, def) => {
	ZodUnion.init(inst, def);
	$ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
	return new ZodDiscriminatedUnion({
		type: "union",
		options,
		discriminator,
		...normalizeParams(params)
	});
}
var ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
var ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
var ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = Object.values(def.entries);
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	return new ZodEnum({
		type: "enum",
		entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
		...normalizeParams(params)
	});
}
var ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
	$ZodLiteral.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
	inst.values = new Set(def.values);
	Object.defineProperty(inst, "value", { get() {
		if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return def.values[0];
	} });
});
function literal(value, params) {
	return new ZodLiteral({
		type: "literal",
		values: Array.isArray(value) ? value : [value],
		...normalizeParams(params)
	});
}
var ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			payload.fallback = true;
			return payload;
		});
		payload.value = output;
		payload.fallback = true;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
var ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
var ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
var ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
var ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
var ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
	});
}
var ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
var ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
var ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function custom(fn, _params) {
	return /* @__PURE__ */ _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
//#endregion
//#region src/audio-player/plugins/configValidators.ts
function validateConfig(schema, config, pluginName) {
	const result = schema.safeParse(config);
	if (result.success) return result.data;
	console.warn(`[Plugin:${pluginName}] Configuration validation failed, falling back to safe defaults.`, result.error);
	const fallbackResult = schema.safeParse({});
	if (fallbackResult.success) return fallbackResult.data;
	return {};
}
var WaveformPluginConfigSchema = object({
	name: string().optional().default("waveform"),
	prewarmPeaks: boolean().optional().default(true)
});
var SleepTimerPluginConfigSchema = object({
	name: string().optional().default("sleep-timer"),
	label: string().optional().default("Sleep"),
	renderUi: boolean().optional().default(true),
	target: custom().optional(),
	now: custom((val) => typeof val === "function").optional()
});
var LyricsPluginConfigSchema = object({
	name: string().optional().default("lyrics"),
	lyrics: string().optional(),
	lines: array(object({
		time: number(),
		text: string()
	})).optional(),
	onLineChange: custom((val) => typeof val === "function").optional(),
	target: custom().optional()
});
var KeyboardShortcutPluginConfigSchema = object({
	name: string().optional().default("keyboard-shortcuts"),
	scope: _enum(["root", "document"]).optional().default("root"),
	seekSeconds: number().positive().optional().default(10),
	enableJKL: boolean().optional().default(true),
	enablePlaylistKeys: boolean().optional().default(true)
});
var AutoThemePluginConfigSchema = object({
	name: string().optional().default("auto-theme"),
	applyGlow: boolean().optional().default(true),
	applyGradient: boolean().optional().default(true),
	sampleSize: number().positive().optional(),
	quantStep: number().positive().optional(),
	onPaletteChange: custom((val) => typeof val === "function").optional()
});
var AutomixPluginConfigSchema = object({
	name: string().optional().default("automix"),
	enabled: boolean().optional().default(true),
	confidenceMin: number().min(0).max(1).optional().default(.1),
	onTransitionChange: custom((val) => typeof val === "function").optional()
});
var AnalyticsPluginConfigSchema = object({
	name: string().optional().default("analytics"),
	endpoint: union([string().url(), string().startsWith("/")]).optional(),
	send: custom((val) => typeof val === "function").optional(),
	includeTimeUpdates: boolean().optional().default(false),
	timeUpdateIntervalSeconds: number().positive().optional().default(15)
});
//#endregion
//#region src/audio-player/plugins/AutomixPlugin.ts
/** Crossfade duration. Conservative fixed value for V1. */
var AUTOMIX_FADE_MS$1 = 5500;
/** How far before the (trimmed) end of A deck B starts preloading. */
var PRELOAD_LEAD_S$1 = 15;
/** Tracks shorter than this never automix. */
var MIN_TRACK_S$1 = 25;
/** Backward currentTime jump beyond this cancels an active fade. */
var SEEK_BACK_TOLERANCE_S$1 = .75;
/** Give up on a handoff if the main element never reaches 'playing'. */
var HANDOFF_TIMEOUT_MS$1 = 6e3;
/** Re-sync the main element at flip time if it drifted past this. */
var MAX_FLIP_DRIFT_S$1 = .35;
/**
* Page-wide latch: once a browser proves it ignores programmatic element
* volume (iOS Safari), crossfading is impossible. Automix then leaves
* playback entirely to the normal end-of-track behavior.
*/
var fadeUnsupported$1 = false;
/**
* Automix as a lifecycle plugin.
*
* One plugin, automatic fallback: it always attempts rich, beat/BPM-aware
* transitions (the "pro" path) and degrades per track-pair to light-mode
* silence-trim crossfades whenever rhythm analysis is unavailable, the browser
* locks element volume, or confidence is below `confidenceMin`.
*
* The implementation intentionally mirrors the legacy `useAutomix` hook: the
* main engine audio element remains deck A/source-of-truth, while this plugin
* owns one detached deck B only around a transition.
*/
var AutomixPlugin = class {
	name;
	context = null;
	enabled;
	onTransitionChange;
	phase = "idle";
	deck = null;
	deckAbort = null;
	preloadedKey = null;
	fadeInterval = null;
	fadeT0 = 0;
	fadeAnchor = 0;
	pendingHandoff = null;
	handoffAbort = null;
	handoffTimer = null;
	failedPair = null;
	prevSourceKey = null;
	transitioning = false;
	confidenceMin;
	plan = null;
	activeFadeMs = AUTOMIX_FADE_MS$1;
	constructor(config = {}) {
		const valid = validateConfig(AutomixPluginConfigSchema, config, "automix");
		this.name = valid.name;
		this.enabled = valid.enabled;
		this.confidenceMin = valid.confidenceMin;
		this.onTransitionChange = valid.onTransitionChange;
	}
	get isTransitioning() {
		return this.transitioning;
	}
	init(playerInstance) {
		this.context = playerInstance;
		this.prevSourceKey = playerInstance.getSourceKey();
		this.analyzeCurrentTrack();
	}
	destroy() {
		this.cancel();
		this.context = null;
		this.prevSourceKey = null;
	}
	updateConfig(config) {
		const nextEnabled = config.enabled ?? this.enabled;
		if (this.enabled && !nextEnabled) this.cancel();
		this.enabled = nextEnabled;
		this.analyzeCurrentTrack();
	}
	onTrackLoad = (track) => {
		const context = this.context;
		if (!context) return;
		const sourceKey = context.getSourceKey();
		if (this.prevSourceKey === null) this.prevSourceKey = sourceKey;
		if (this.prevSourceKey !== sourceKey) {
			this.prevSourceKey = sourceKey;
			const expected = this.pendingHandoff;
			if (expected !== null && this.phase === "handoff" && track && trackKey(track) === expected) this.attachHandoff();
			else if (this.phase !== "idle") this.cancel();
		}
		if (this.enabled && track) this.ensureAnalysis(track);
		if (this.enabled && this.usePro()) {
			const next = context.getNextTrack();
			if (next) this.ensureAnalysis(next);
		}
		this.supervise();
	};
	onPlay = () => {
		this.supervise();
	};
	onPause = () => {
		this.supervise();
	};
	onSeek = (_position) => {
		if (this.phase === "fading") this.cancel();
		else this.supervise();
	};
	onTimeUpdate = (_position) => {
		this.supervise();
	};
	onTrackEnded = () => this.handleTrackEnded();
	/** Legacy controller bridge used by `useAutomix`. */
	handleTrackEnded() {
		if (this.phase === "fading") {
			this.finalizeFade(false);
			return false;
		}
		return this.phase === "handoff";
	}
	analyzeCurrentTrack() {
		if (!this.enabled || !this.context) return;
		const track = this.context.getCurrentTrack();
		if (track) this.ensureAnalysis(track);
		if (this.usePro()) {
			const next = this.context.getNextTrack();
			if (next) this.ensureAnalysis(next);
		}
	}
	/**
	* Whether to attempt rich (beat/BPM-aware) analysis. Always on, except
	* where fades can't run at all (volume-locked browsers), since beat-aware
	* timing is pointless without crossfades. Per-pair confidence still decides
	* whether a given transition uses the rich plan or the light fallback.
	*/
	usePro() {
		return !fadeUnsupported$1;
	}
	ensureAnalysis(track) {
		return this.usePro() ? ensureProTrackAnalysis(track) : ensureTrackAnalysis(track);
	}
	/** Trims from the Pro analysis when available, else the Lite silence scan. */
	effectiveTrims(track) {
		if (this.usePro()) {
			const analysis = getTrackAnalysis(track);
			if (analysis) return {
				trimStartMs: analysis.trimStartMs ?? 0,
				trimEndMs: analysis.trimEndMs ?? 0
			};
		}
		return getTrackTrims(track);
	}
	/**
	* Where deck B should be parked before the fade, in milliseconds. The
	* beat-aligned entry point applies only while a confident pair plan is
	* active; any fallback parks at the silence trim start exactly like Lite,
	* so low-confidence beat guesses never skip the next track's intro.
	*/
	deckStartMs(next) {
		if (this.usePro()) {
			if (this.plan) return this.plan.deckStartMsInB;
			const analysis = getTrackAnalysis(next);
			if (analysis) return analysis.trimStartMs ?? 0;
		}
		return getTrackTrims(next)?.trimStartMs ?? 0;
	}
	setTransitioning(next) {
		if (this.transitioning === next) return;
		this.transitioning = next;
		this.onTransitionChange?.(next);
	}
	stopRamp() {
		if (this.fadeInterval !== null) {
			clearInterval(this.fadeInterval);
			this.fadeInterval = null;
		}
	}
	releaseDeck() {
		this.deckAbort?.abort();
		this.deckAbort = null;
		this.preloadedKey = null;
		this.plan = null;
		this.activeFadeMs = AUTOMIX_FADE_MS$1;
		const deck = this.deck;
		this.deck = null;
		if (deck) try {
			deck.pause();
			deck.removeAttribute("src");
			deck.load();
		} catch {}
	}
	clearHandoff() {
		this.pendingHandoff = null;
		this.handoffAbort?.abort();
		this.handoffAbort = null;
		if (this.handoffTimer !== null) {
			clearTimeout(this.handoffTimer);
			this.handoffTimer = null;
		}
	}
	/** Abort any in-flight transition and restore normal playback audio. */
	cancel = () => {
		const wasAudible = this.phase === "fading" || this.phase === "handoff";
		this.stopRamp();
		this.clearHandoff();
		this.releaseDeck();
		this.phase = "idle";
		this.setTransitioning(false);
		if (wasAudible && this.context) {
			const main = this.context.getAudioElement();
			const volume = this.context.getEngine().volume;
			if (main) try {
				main.volume = volume;
			} catch {}
		}
	};
	/**
	* The fade is over (ramp completed, or A reached its natural end first).
	* Mark the upcoming source change as ours; optionally trigger it.
	*/
	finalizeFade(advance) {
		this.stopRamp();
		this.pendingHandoff = this.preloadedKey;
		this.phase = "handoff";
		if (advance) this.context?.requestAdvance?.();
	}
	/** Wire deck B for the resolved next track and park it at its trim start. */
	startPreload(next) {
		if (typeof Audio === "undefined" || !this.context) return;
		const src = getPrimaryTrackSource(next);
		if (!src) return;
		const key = trackKey(next);
		const deck = new Audio();
		deck.preload = "auto";
		try {
			deck.volume = 0;
		} catch {}
		deck.src = src;
		const ac = new AbortController();
		const applyTrimStart = () => {
			const startMs = this.deckStartMs(next);
			if (startMs <= 0) return;
			if (deck.paused && deck.readyState >= 1) try {
				deck.currentTime = startMs / 1e3;
			} catch {}
		};
		deck.addEventListener("loadedmetadata", applyTrimStart, { signal: ac.signal });
		deck.addEventListener("error", () => {
			this.failedPair = `${this.context?.getSourceKey() ?? ""}->${key}`;
			if (this.phase === "fading" || this.phase === "handoff") this.cancel();
			else if (this.phase === "preloading") {
				this.releaseDeck();
				this.phase = "idle";
			}
		}, { signal: ac.signal });
		try {
			deck.load();
		} catch {
			return;
		}
		this.deckAbort = ac;
		this.deck = deck;
		this.preloadedKey = key;
		this.phase = "preloading";
		this.ensureAnalysis(next).then(applyTrimStart);
	}
	/**
	* Equal-power ramp driven by wall-clock setInterval (keeps progressing in
	* throttled background tabs, unlike rAF). Re-reads the user volume every
	* tick so a mid-fade volume change re-targets instead of fighting.
	*/
	runRamp() {
		const tick = () => {
			if (this.phase !== "fading") {
				this.stopRamp();
				return;
			}
			const context = this.context;
			const main = context?.getAudioElement();
			const deck = this.deck;
			if (!context || !main || !deck) {
				this.cancel();
				return;
			}
			const t = Math.min(1, (performance.now() - this.fadeT0) / this.activeFadeMs);
			const vol = context.getEngine().volume;
			const mainTarget = Math.cos(t * Math.PI / 2) * vol;
			const deckTarget = Math.sin(t * Math.PI / 2) * vol;
			try {
				main.volume = mainTarget;
				deck.volume = deckTarget;
			} catch {
				fadeUnsupported$1 = true;
				this.cancel();
				return;
			}
			if (vol > .1 && Math.abs(main.volume - mainTarget) > .05) {
				fadeUnsupported$1 = true;
				this.cancel();
				return;
			}
			if (t >= 1) {
				this.stopRamp();
				this.finalizeFade(true);
			}
		};
		this.stopRamp();
		this.fadeInterval = setInterval(tick, 33);
	}
	startFade() {
		const context = this.context;
		const main = context?.getAudioElement();
		const deck = this.deck;
		if (!context || !main || !deck) return;
		if (fadeUnsupported$1 || context.getEngine().volumeUnsupported) return;
		if (deck.readyState < 2) return;
		try {
			deck.volume = 0;
			if (deck.volume > .001) {
				fadeUnsupported$1 = true;
				return;
			}
			deck.muted = main.muted;
		} catch {
			fadeUnsupported$1 = true;
			return;
		}
		let playPromise;
		try {
			playPromise = deck.play();
		} catch {
			this.failedPair = `${context.getSourceKey()}->${this.preloadedKey}`;
			this.releaseDeck();
			this.phase = "idle";
			return;
		}
		this.phase = "fading";
		this.setTransitioning(true);
		this.activeFadeMs = this.plan?.fadeMs ?? 5500;
		this.fadeT0 = performance.now();
		this.fadeAnchor = context.getEngine().currentTime;
		playPromise.then(() => {
			if (this.phase === "fading") this.runRamp();
		}).catch(() => {
			if (this.phase === "fading") {
				this.failedPair = `${this.context?.getSourceKey() ?? ""}->${this.preloadedKey}`;
				this.cancel();
			}
		});
	}
	/**
	* After requestAdvance, the host swaps sources and the engine reloads the
	* main element with B's URL. Sync it to deck B's position and flip the
	* audible output back to the main element on its first 'playing'.
	*/
	attachHandoff() {
		this.pendingHandoff = null;
		const main = this.context?.getAudioElement();
		const deck = this.deck;
		if (!main || !deck) {
			this.cancel();
			return;
		}
		const ac = new AbortController();
		this.handoffAbort = ac;
		const syncTime = () => {
			try {
				main.currentTime = deck.currentTime;
			} catch {}
		};
		if (main.readyState >= 1) syncTime();
		else main.addEventListener("loadedmetadata", syncTime, {
			signal: ac.signal,
			once: true
		});
		main.addEventListener("playing", () => {
			try {
				if (Math.abs(deck.currentTime - main.currentTime) > MAX_FLIP_DRIFT_S$1) syncTime();
				main.volume = this.context?.getEngine().volume ?? main.volume;
			} catch {}
			this.clearHandoff();
			this.releaseDeck();
			this.phase = "idle";
			this.setTransitioning(false);
		}, {
			signal: ac.signal,
			once: true
		});
		main.addEventListener("error", this.cancel, {
			signal: ac.signal,
			once: true
		});
		this.handoffTimer = setTimeout(this.cancel, HANDOFF_TIMEOUT_MS$1);
	}
	supervise() {
		if (!this.enabled || !this.context) return;
		const context = this.context;
		const engine = context.getEngine();
		const phase = this.phase;
		const currentTrack = context.getCurrentTrack();
		const nextTrack = context.getNextTrack();
		const sourceKey = context.getSourceKey();
		if (phase === "fading") {
			if (!engine.isPlaying || engine.isSeeking || engine.hasError) {
				this.cancel();
				return;
			}
			if (engine.currentTime < this.fadeAnchor - SEEK_BACK_TOLERANCE_S$1) {
				this.cancel();
				return;
			}
			if (!nextTrack || trackKey(nextTrack) !== this.preloadedKey) this.cancel();
			return;
		}
		if (phase === "handoff") return;
		if (!currentTrack || !nextTrack) {
			if (phase === "preloading") {
				this.releaseDeck();
				this.phase = "idle";
			}
			return;
		}
		if (!engine.isPlaying || engine.isSeeking || engine.hasError) return;
		if (engine.duration < MIN_TRACK_S$1) return;
		if (!context.getAudioElement()) return;
		const nextKey = trackKey(nextTrack);
		if (this.failedPair === `${sourceKey}->${nextKey}`) return;
		const trims = this.effectiveTrims(currentTrack);
		const effectiveEnd = engine.duration - (trims ? trims.trimEndMs / 1e3 : 0);
		let plan = null;
		if (this.usePro()) {
			this.ensureAnalysis(nextTrack);
			const outgoing = getTrackAnalysis(currentTrack);
			const incoming = getTrackAnalysis(nextTrack);
			if (outgoing && incoming) {
				const candidate = planTransition(outgoing, incoming, engine.duration * 1e3, AUTOMIX_FADE_MS$1, this.confidenceMin);
				if (candidate.usedPro) plan = candidate;
			}
		}
		this.plan = plan;
		const fadeMs = plan?.fadeMs ?? 5500;
		const fadeStartAt = Math.max(plan ? plan.fadeStartMsInA / 1e3 : effectiveEnd - fadeMs / 1e3, engine.duration * .5);
		if (phase === "idle") {
			const leadS = Math.max(PRELOAD_LEAD_S$1, fadeMs / 1e3 + 5);
			if (engine.currentTime >= effectiveEnd - leadS) this.startPreload(nextTrack);
			return;
		}
		if (this.preloadedKey !== nextKey) {
			this.releaseDeck();
			this.phase = "idle";
			return;
		}
		if (engine.currentTime >= fadeStartAt) this.startFade();
	}
};
/**
* Create the Automix plugin. BPM/beat/energy analysis steers fade timing and
* length when available; any pair without trustworthy analysis falls back to
* light-mode silence-trim crossfades automatically.
*/
function createAutomixPlugin(config) {
	return new AutomixPlugin(config);
}
//#endregion
//#region src/audio-player/plugins/automixIntegration.ts
/**
* Canonical plugin name for Automix. The internal controller and the public
* `createAutomixPlugin()` both use this, so the player can detect an externally
* supplied Automix plugin and avoid running a second one beside it.
*/
var AUTOMIX_PLUGIN_NAME = "automix";
/**
* Whether a plugin list already contains an Automix controller.
*
* Detect by type first so any `AutomixPlugin` instance counts regardless of its
* `name` — the built-in plugin registry, for example, registers Automix as
* `"registry-automix"`. The canonical-name check is a defensive fallback for
* automix-equivalent plugins that aren't `AutomixPlugin` instances.
*/
function hasAutomixPlugin(plugins) {
	return plugins.some((plugin) => plugin instanceof AutomixPlugin || plugin.name === "automix");
}
/**
* Merge the player's internal Automix plugin into the consumer's plugin list,
* but only when the consumer hasn't already supplied their own Automix plugin.
*
* This is what guarantees a *single* Automix controller: the `automix` prop/menu
* drives the internal plugin, and an explicitly passed external Automix plugin
* takes precedence (the internal one is omitted) so the two transition systems
* can never both run and double-advance the queue.
*/
function withInternalAutomix(externalPlugins, internal) {
	return hasAutomixPlugin(externalPlugins) ? externalPlugins : [...externalPlugins, internal];
}
//#endregion
//#region src/audio-player/core/plugins/PluginErrorBoundary.ts
/**
* Plugin Error Boundary Pattern
* 
* Provides structured error handling for plugins with:
* - Custom error classes with plugin context
* - Error handler interface for host applications
* - Graceful degradation strategies
* - Recovery mechanisms
*/
var PluginError = class PluginError extends Error {
	pluginName;
	operation;
	cause;
	recoverable;
	timestamp;
	stack;
	constructor(pluginName, operation, cause, recoverable) {
		const message = `Plugin "${pluginName}" failed during ${operation}`;
		super(message);
		this.pluginName = pluginName;
		this.operation = operation;
		this.cause = cause;
		this.recoverable = recoverable;
		this.name = "PluginError";
		this.timestamp = /* @__PURE__ */ new Date();
		Object.setPrototypeOf(this, PluginError.prototype);
	}
	/**
	* Create a PluginError from a caught error
	*/
	static fromError(pluginName, operation, error, recoverable = true) {
		if (error instanceof PluginError) return new PluginError(pluginName, operation, error.cause, recoverable);
		return new PluginError(pluginName, operation, error, recoverable);
	}
	/**
	* Create a non-recoverable PluginError
	*/
	static fatal(pluginName, operation, cause) {
		return new PluginError(pluginName, operation, cause, false);
	}
	/**
	* Create a recoverable PluginError (warning-level)
	*/
	static warning(pluginName, operation, cause) {
		return new PluginError(pluginName, operation, cause, true);
	}
	/**
	* Get a sanitized error object for logging/serialization
	*/
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			pluginName: this.pluginName,
			operation: this.operation,
			recoverable: this.recoverable,
			timestamp: this.timestamp.toISOString(),
			cause: this.cause instanceof PluginError ? this.cause.toJSON() : this.cause instanceof Error ? {
				name: this.cause.name,
				message: this.cause.message,
				stack: this.cause.stack
			} : this.cause,
			stack: this.stack
		};
	}
};
/**
* Default error handler implementation - logs to console
*/
var DefaultPluginErrorHandler = class {
	failureCounts = /* @__PURE__ */ new Map();
	maxFailuresBeforeDisable;
	logger;
	constructor(maxFailuresBeforeDisable = 3, logger = console) {
		this.maxFailuresBeforeDisable = maxFailuresBeforeDisable;
		this.logger = logger;
	}
	onError(info) {
		const { error, severity, context } = info;
		const { pluginName, operation, recoverable, cause } = error;
		const count = (this.failureCounts.get(pluginName) || 0) + 1;
		this.failureCounts.set(pluginName, count);
		const logData = {
			plugin: pluginName,
			operation,
			severity,
			recoverable,
			failureCount: count,
			cause: cause instanceof Error ? {
				name: cause.name,
				message: cause.message,
				stack: cause.stack
			} : cause,
			context,
			timestamp: error.timestamp.toISOString()
		};
		if (severity === "error") this.logger.error("[PluginError]", JSON.stringify(logData, null, 2));
		else if (severity === "warning") this.logger.warn("[PluginWarning]", JSON.stringify(logData, null, 2));
		else this.logger.info("[PluginInfo]", JSON.stringify(logData, null, 2));
		if (!recoverable || count >= this.maxFailuresBeforeDisable) return {
			action: "disable_plugin",
			suppressLogging: false,
			userMessage: `Plugin "${pluginName}" has been disabled due to repeated failures.`
		};
		if (operation.startsWith("hook:")) return {
			action: "skip_hook",
			suppressLogging: false
		};
		if (operation.startsWith("init:")) return {
			action: "disable_plugin",
			suppressLogging: false,
			userMessage: `Plugin "${pluginName}" failed to initialize and has been disabled.`
		};
		return {
			action: "fallback",
			suppressLogging: false
		};
	}
	onWarning(pluginName, message, context) {
		this.logger.warn(`[PluginWarning] ${pluginName}: ${message}`, context ?? "");
	}
	onPluginDisabled(pluginName, failureCount) {
		this.logger.error(`[PluginError] Plugin "${pluginName}" disabled after ${failureCount} failures`);
	}
	onPluginRecovered(pluginName, previousAction) {
		this.logger.info(`[PluginRecovery] Plugin "${pluginName}" recovered after ${previousAction}`);
		this.failureCounts.delete(pluginName);
	}
	/**
	* Get the failure count for a plugin
	*/
	getFailureCount(pluginName) {
		return this.failureCounts.get(pluginName) || 0;
	}
	/**
	* Reset the failure count for a plugin
	*/
	resetFailureCount(pluginName) {
		this.failureCounts.delete(pluginName);
	}
};
/**
* Error boundary that wraps plugin operations with structured error handling
*/
var PluginErrorBoundary = class {
	handler;
	pluginName;
	isDisabled = false;
	constructor(pluginName, handler) {
		this.pluginName = pluginName;
		this.handler = handler;
	}
	getHandler() {
		return this.handler;
	}
	getPluginName() {
		return this.pluginName;
	}
	isPluginDisabled() {
		return this.isDisabled;
	}
	async execute(operation, fn, options = {}) {
		if (this.isDisabled) throw new PluginError(this.pluginName, operation, /* @__PURE__ */ new Error("Plugin is disabled"), false);
		const { recoverable = true, severity = "error", context, fallback } = options;
		try {
			return await fn();
		} catch (error) {
			const pluginError = PluginError.fromError(this.pluginName, operation, error, recoverable);
			const info = {
				error: pluginError,
				severity,
				context
			};
			const result = await this.handler.onError(info);
			switch (result.action) {
				case "disable_plugin":
					this.isDisabled = true;
					await this.handler.onPluginDisabled(this.pluginName, this.getFailureCount());
					if (fallback !== void 0) return fallback;
					throw pluginError;
				case "skip_hook": return fallback;
				case "fallback":
					if (fallback !== void 0) return fallback;
					throw pluginError;
				case "retry_operation": {
					const delay = result.retryDelayMs ?? 1e3;
					await new Promise((resolve) => setTimeout(resolve, delay));
					return this.execute(operation, fn, options);
				}
				case "reset_plugin": throw pluginError;
				default: throw pluginError;
			}
		}
	}
	executeSync(operation, fn, options = {}) {
		if (this.isDisabled) throw new PluginError(this.pluginName, operation, /* @__PURE__ */ new Error("Plugin is disabled"), false);
		const { recoverable = true, severity = "error", context, fallback } = options;
		try {
			return fn();
		} catch (error) {
			const pluginError = PluginError.fromError(this.pluginName, operation, error, recoverable);
			const info = {
				error: pluginError,
				severity,
				context
			};
			const handlerResult = this.handler.onError(info);
			if (handlerResult instanceof Promise) {
				handlerResult.then((result) => {
					if (result.action === "disable_plugin") {
						this.isDisabled = true;
						Promise.resolve(this.handler.onPluginDisabled(this.pluginName, this.getFailureCount())).catch(() => {});
					}
				}).catch(() => {});
				if (!recoverable) throw pluginError;
				if (fallback !== void 0) return fallback;
				throw pluginError;
			}
			switch (handlerResult.action) {
				case "disable_plugin":
					this.isDisabled = true;
					Promise.resolve(this.handler.onPluginDisabled(this.pluginName, this.getFailureCount())).catch(() => {});
					if (fallback !== void 0) return fallback;
					throw pluginError;
				case "skip_hook": return fallback;
				case "fallback":
					if (fallback !== void 0) return fallback;
					throw pluginError;
				default: throw pluginError;
			}
		}
	}
	warn(message, context) {
		this.handler.onWarning(this.pluginName, message, context);
	}
	enable() {
		this.isDisabled = false;
	}
	disable() {
		this.isDisabled = true;
	}
	reset() {
		this.isDisabled = false;
		if (this.handler instanceof DefaultPluginErrorHandler) this.handler.resetFailureCount(this.pluginName);
		else if (typeof this.handler.resetFailureCount === "function") this.handler.resetFailureCount(this.pluginName);
	}
	/**
	* Get failure count for this plugin from the handler (if supported)
	*/
	getFailureCount() {
		if (this.handler instanceof DefaultPluginErrorHandler) return this.handler.getFailureCount(this.pluginName);
		if (typeof this.handler.getFailureCount === "function") return this.handler.getFailureCount(this.pluginName);
		return 0;
	}
};
/**
* Factory for creating plugin error boundaries with a shared handler
*/
var PluginErrorBoundaryFactory = class {
	handler;
	constructor(handler) {
		this.handler = handler ?? new DefaultPluginErrorHandler();
	}
	createBoundary(pluginName) {
		return new PluginErrorBoundary(pluginName, this.handler);
	}
	getHandler() {
		return this.handler;
	}
};
/**
* Global error boundary factory instance (can be replaced by host app)
*/
var globalErrorBoundaryFactory = new PluginErrorBoundaryFactory();
/**
* Set a custom error handler for all plugins
* Call this before initializing any plugins
*/
function setGlobalErrorHandler(handler) {
	globalErrorBoundaryFactory = new PluginErrorBoundaryFactory(handler);
}
/**
* Get the current global error boundary factory
*/
function getGlobalErrorBoundaryFactory() {
	return globalErrorBoundaryFactory;
}
/**
* Create an error boundary for a specific plugin using the global handler
*/
function createPluginErrorBoundary(pluginName) {
	return globalErrorBoundaryFactory.createBoundary(pluginName);
}
/**
* Graceful degradation strategies for common plugin operations
*/
var GracefulDegradation = {
	forInit: (defaultValue) => defaultValue,
	forHook: (defaultValue) => defaultValue,
	forTrackLoad: (track) => track,
	forPlay: () => void 0,
	forPause: () => void 0,
	forSeek: (position) => position,
	forTimeUpdate: (position) => position,
	forTrackEnded: () => false,
	forDestroy: () => void 0
};
/**
* Helper to wrap a plugin with error boundary protection.
* Proxies method calls through the error boundary for structured error handling.
*/
function withErrorBoundary(plugin, boundary) {
	const wrapped = { ...plugin };
	wrapped._errorBoundary = boundary;
	return new Proxy(wrapped, { get(target, prop, receiver) {
		const value = Reflect.get(target, prop, receiver);
		if (typeof value !== "function" || prop === "_errorBoundary" || prop === "constructor") return value;
		return function(...args) {
			const fn = value.bind(target);
			const operation = `method:${String(prop)}`;
			try {
				const result = fn(...args);
				if (result instanceof Promise || result && typeof result.then === "function") return boundary.execute(operation, () => result);
				return result;
			} catch (error) {
				return boundary.executeSync(operation, () => {
					throw error;
				});
			}
		};
	} });
}
/**
* Type guard to check if an error is a PluginError
*/
function isPluginError(error) {
	return error instanceof PluginError;
}
//#endregion
//#region src/audio-player/core/plugins/PluginDebugger.ts
var PluginDebugger = class {
	debugMode = false;
	hooks = /* @__PURE__ */ new Map();
	constructor() {
		if (typeof window !== "undefined") {
			if (window.AUDIO_PLAYER_DEBUG === "1" || window.AUDIO_PLAYER_DEBUG === 1 || false) this.debugMode = true;
		}
	}
	measure(plugin, hook, fn) {
		if (!this.debugMode) return fn();
		const start = performance.now();
		try {
			return fn();
		} finally {
			const duration = performance.now() - start;
			this.hooks.set(`${plugin}:${hook}`, duration);
			console.log(`[Plugin:${plugin}] ${hook} took ${duration.toFixed(2)}ms`);
		}
	}
	async measureAsync(plugin, hook, fn) {
		if (!this.debugMode) return fn();
		const start = performance.now();
		try {
			return await fn();
		} finally {
			const duration = performance.now() - start;
			this.hooks.set(`${plugin}:${hook}`, duration);
			console.log(`[Plugin:${plugin}] ${hook} took ${duration.toFixed(2)}ms`);
		}
	}
	getMemoryUsage() {
		if (typeof performance !== "undefined" && "memory" in performance) return performance.memory.usedJSHeapSize;
	}
};
//#endregion
//#region src/audio-player/core/plugins/PluginManager.ts
/** Register plugins and safely dispatch player lifecycle hooks. */
var PluginManager = class {
	plugins = /* @__PURE__ */ new Map();
	context;
	errorBoundaryFactory;
	defaultOptions;
	debugger;
	constructor(context, options = {}) {
		this.context = context;
		this.defaultOptions = {
			errorHandler: options.errorHandler ?? new DefaultPluginErrorHandler(options.maxFailuresBeforeDisable),
			maxFailuresBeforeDisable: options.maxFailuresBeforeDisable ?? 3
		};
		this.errorBoundaryFactory = new PluginErrorBoundaryFactory(this.defaultOptions.errorHandler);
		this.debugger = new PluginDebugger();
	}
	setContext(context) {
		this.context = context;
	}
	/**
	* Set a custom error handler for future plugin registrations
	* Note: Already registered plugins keep their original error boundaries
	*/
	setErrorHandler(handler) {
		this.defaultOptions.errorHandler = handler;
		this.errorBoundaryFactory = new PluginErrorBoundaryFactory(handler);
	}
	register(plugin) {
		if (!plugin?.name) {
			this.handleError("register", /* @__PURE__ */ new Error("Plugin is missing a name"), "error");
			return;
		}
		const existing = this.plugins.get(plugin.name);
		if (existing?.plugin === plugin) return;
		if (existing) this.unregister(plugin.name);
		const errorBoundary = this.errorBoundaryFactory.createBoundary(plugin.name);
		let cleanup;
		try {
			const result = errorBoundary.executeSync("init", () => plugin.init(this.context), {
				recoverable: false,
				severity: "error",
				context: { pluginName: plugin.name }
			});
			if (typeof result === "function") cleanup = result;
			this.plugins.set(plugin.name, {
				plugin,
				cleanup,
				errorBoundary
			});
		} catch (error) {
			try {
				errorBoundary.executeSync("destroy", () => plugin.destroy(), {
					recoverable: false,
					severity: "error",
					context: { pluginName: plugin.name }
				});
			} catch {}
		}
	}
	unregister(name) {
		const registered = this.plugins.get(name);
		if (!registered) return;
		this.plugins.delete(name);
		try {
			registered.cleanup?.();
		} catch (error) {
			this.handleError(`cleanup:${name}`, error, "warning", { pluginName: name });
		}
		try {
			registered.plugin.destroy();
		} catch (error) {
			this.handleError(`destroy:${name}`, error, "warning", { pluginName: name });
		}
	}
	replace(nextPlugins) {
		const nextNames = new Set(nextPlugins.map((plugin) => plugin.name));
		for (const name of this.plugins.keys()) if (!nextNames.has(name)) this.unregister(name);
		for (const plugin of nextPlugins) this.register(plugin);
	}
	clear() {
		for (const name of [...this.plugins.keys()]) this.unregister(name);
	}
	has(name) {
		return this.plugins.has(name);
	}
	list() {
		return [...this.plugins.values()].map(({ plugin }) => plugin);
	}
	/**
	* Get health and debug status for all plugins
	*/
	getDebugStatus() {
		return [...this.plugins.values()].map(({ plugin, errorBoundary }) => ({
			name: plugin.name,
			initialized: true,
			lastHookCalled: null,
			lastHookTime: null,
			errorCount: errorBoundary.getFailureCount(),
			memoryUsage: this.debugger.getMemoryUsage()
		}));
	}
	/**
	* Get the error boundary for a specific plugin
	*/
	getErrorBoundary(pluginName) {
		return this.plugins.get(pluginName)?.errorBoundary;
	}
	/**
	* Check if a plugin is disabled due to errors
	*/
	isPluginDisabled(pluginName) {
		return this.plugins.get(pluginName)?.errorBoundary.isPluginDisabled() ?? false;
	}
	/**
	* Manually re-enable a disabled plugin
	*/
	enablePlugin(pluginName) {
		const boundary = this.plugins.get(pluginName)?.errorBoundary;
		if (boundary) {
			boundary.enable();
			return true;
		}
		return false;
	}
	trigger(hook, ...args) {
		const results = [];
		for (const { plugin, errorBoundary } of this.plugins.values()) {
			const hookFn = plugin[hook];
			if (typeof hookFn !== "function") continue;
			try {
				const result = errorBoundary.executeSync(`hook:${hook}`, () => this.debugger.measure(plugin.name, hook, () => hookFn.call(plugin, ...args)), {
					recoverable: true,
					severity: "warning",
					fallback: void 0,
					context: {
						hook,
						pluginName: plugin.name
					}
				});
				if (result !== void 0) results.push(result);
			} catch {
				continue;
			}
		}
		return results;
	}
	triggerUntilHandled(hook, ...args) {
		for (const { plugin, errorBoundary } of this.plugins.values()) {
			const hookFn = plugin[hook];
			if (typeof hookFn !== "function") continue;
			try {
				if (errorBoundary.executeSync(`hook:${hook}`, () => this.debugger.measure(plugin.name, hook, () => hookFn.call(plugin, ...args) === true), {
					recoverable: true,
					severity: "warning",
					fallback: false,
					context: {
						hook,
						pluginName: plugin.name
					}
				})) return true;
			} catch {
				continue;
			}
		}
		return false;
	}
	/**
	* Handle plugin errors with structured error handling
	*/
	handleError(scope, error, severity = "error", context) {
		const pluginName = context?.pluginName ?? scope.split(":")[1] ?? "unknown";
		const pluginError = isPluginError(error) ? error : PluginError.fromError(pluginName, scope, error, severity !== "error");
		const boundary = this.plugins.get(pluginName)?.errorBoundary;
		const handler = boundary ? this.getBoundaryHandler(boundary) : this.defaultOptions.errorHandler;
		const info = {
			error: pluginError,
			severity,
			context
		};
		Promise.resolve(handler.onError(info)).then((result) => {
			if (result.action === "disable_plugin" && boundary) {
				boundary.disable();
				const failureCount = boundary.getFailureCount();
				Promise.resolve(handler.onPluginDisabled(pluginName, failureCount)).catch(() => {});
			}
		}).catch(() => {
			if (severity === "error") console.error("[PluginManager] Error handler threw:", pluginError.message);
		});
	}
	getBoundaryHandler(boundary) {
		return boundary.getHandler();
	}
};
//#endregion
//#region src/audio-player/core/plugins/usePluginManager.ts
/** React bridge that keeps a PluginManager stable while plugin arrays change. */
function usePluginManager(plugins, context, options) {
	const managerRef = useRef(null);
	const memoizedOptions = useMemo(() => options, [options?.errorHandler, options?.maxFailuresBeforeDisable]);
	if (managerRef.current === null) managerRef.current = new PluginManager(context, memoizedOptions);
	else managerRef.current.setContext(context);
	const manager = managerRef.current;
	const prevPluginsRef = useRef(null);
	const churnWarnedRef = useRef(false);
	const prev = prevPluginsRef.current;
	if (prev !== null && prev !== plugins && !churnWarnedRef.current && typeof console !== "undefined" && sameNameSet(prev, plugins)) {
		churnWarnedRef.current = true;
		console.warn("[AudioPlayer] The `plugins` array changed identity but contains the same plugin names. Pass a stable reference (e.g. wrap it in useMemo) so plugins are not destroyed and recreated on every render.");
	}
	prevPluginsRef.current = plugins;
	useEffect(() => {
		manager.replace(plugins);
	}, [manager, plugins]);
	useEffect(() => () => manager.clear(), [manager]);
	return manager;
}
/** Whether two plugin arrays contain exactly the same multiset of plugin names. */
function sameNameSet(a, b) {
	if (a.length !== b.length) return false;
	const namesA = a.map((plugin) => plugin.name).sort();
	const namesB = b.map((plugin) => plugin.name).sort();
	return namesA.every((name, i) => name === namesB[i]);
}
//#endregion
//#region src/audio-player/core/audio/AudioSpriteEngine.ts
function getAudioContextCtor() {
	if (typeof window === "undefined") return void 0;
	return window.AudioContext ?? window.webkitAudioContext;
}
function clamp01$2(value) {
	if (!Number.isFinite(value)) return 1;
	return Math.max(0, Math.min(1, value));
}
function positiveSeconds(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, value);
}
var nextInstanceId = 0;
function createInstanceId() {
	nextInstanceId += 1;
	return `sap-sprite-${nextInstanceId}`;
}
/**
* SAP-native audio sprite engine for short Vault Radio / plugin-layer sounds.
*
* This intentionally does not replace the player's track playback backend. It
* decodes one declared pack and lets trusted SAP plugin surfaces trigger named
* slices through Web Audio (`AudioBufferSourceNode.start(when, offset, duration)`).
*/
var AudioSpriteEngine = class {
	ctx = null;
	output = null;
	manifest = null;
	buffer = null;
	loadAbort = null;
	loadPromise = null;
	instances = /* @__PURE__ */ new Map();
	generation = 0;
	/**
	* Desired master gain for the whole sprite layer (the "ambience volume"
	* control points here). Stored so it survives context recreation, since
	* `ensureContext` builds a fresh `output` GainNode at unity otherwise.
	*/
	masterVolume = 1;
	ensureContext() {
		if (this.ctx && this.ctx.state !== "closed") return this.ctx;
		const Ctor = getAudioContextCtor();
		if (!Ctor) throw new Error("Web Audio API unavailable for SAP sprites.");
		this.ctx = new Ctor();
		this.output = this.ctx.createGain();
		this.output.gain.value = this.masterVolume;
		this.output.connect(this.ctx.destination);
		return this.ctx;
	}
	/**
	* Set the master output level (0..1) for the whole sprite layer. Persisted
	* across context recreation so a later (re)load doesn't silently reset it.
	*/
	setMasterVolume(value) {
		this.masterVolume = clamp01$2(value);
		if (this.output && this.ctx) this.output.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
	}
	getMasterVolume() {
		return this.masterVolume;
	}
	async load(manifest) {
		const src = manifest.src.trim();
		if (!src) throw new Error("Audio sprite manifest requires a src URL.");
		this.generation += 1;
		const generation = this.generation;
		this.loadAbort?.abort();
		this.stopAll();
		this.manifest = {
			...manifest,
			src
		};
		this.buffer = null;
		const abort = new AbortController();
		this.loadAbort = abort;
		const work = (async () => {
			const response = await fetch(src, { signal: abort.signal });
			if (!response.ok) throw new Error(`Audio sprite pack failed to load: ${response.status}`);
			const data = await response.arrayBuffer();
			const decoded = await this.ensureContext().decodeAudioData(data);
			if (generation !== this.generation) return;
			this.buffer = decoded;
		})();
		this.loadPromise = work.then(() => {}, () => {});
		try {
			await work;
		} finally {
			if (this.loadAbort === abort) this.loadAbort = null;
		}
	}
	async ready() {
		let pending = this.loadPromise;
		while (pending) {
			await pending;
			if (pending === this.loadPromise) break;
			pending = this.loadPromise;
		}
	}
	play(clipName, options = {}) {
		const manifest = this.manifest;
		const buffer = this.buffer;
		if (!manifest || !buffer) return null;
		const clip = manifest.clips[clipName];
		if (!clip) return null;
		const ctx = this.ensureContext();
		ctx.resume().catch(() => {});
		const output = this.output;
		if (!output) return null;
		const offset = Math.min(positiveSeconds(clip.offset), buffer.duration);
		const duration = Math.min(positiveSeconds(clip.duration), Math.max(0, buffer.duration - offset));
		if (duration <= 0) return null;
		const loop = options.loop ?? clip.loop ?? false;
		const volume = clamp01$2(options.volume ?? clip.volume ?? 1);
		const id = createInstanceId();
		const source = ctx.createBufferSource();
		const gain = ctx.createGain();
		source.buffer = buffer;
		source.loop = loop;
		if (loop) {
			source.loopStart = offset;
			source.loopEnd = offset + duration;
		}
		gain.gain.setValueAtTime(volume, ctx.currentTime);
		source.connect(gain);
		gain.connect(output);
		const instance = {
			id,
			clipName,
			loop,
			volume,
			source,
			gain
		};
		this.instances.set(id, instance);
		source.onended = () => {
			if (this.instances.get(id) === instance) this.removeInstance(id);
		};
		source.start(0, offset, loop ? void 0 : duration);
		return id;
	}
	stop(id) {
		const instance = this.instances.get(id);
		if (!instance) return;
		instance.source.onended = null;
		try {
			instance.source.stop();
		} catch {}
		this.removeInstance(id);
	}
	fade(id, toVolume, durationMs) {
		const instance = this.instances.get(id);
		if (!instance || !this.ctx) return;
		this.clearFadeStop(instance);
		const gain = instance.gain.gain;
		const now = this.ctx.currentTime;
		const duration = Math.max(0, durationMs) / 1e3;
		const target = clamp01$2(toVolume);
		gain.cancelScheduledValues(now);
		gain.setValueAtTime(gain.value, now);
		gain.linearRampToValueAtTime(target, now + duration);
		instance.volume = target;
	}
	/**
	* Ramp an instance to silence and then stop it. Unlike `fade(id, 0, ms)`,
	* this releases the underlying source when the ramp completes — essential
	* for looping clips, which otherwise keep running silently forever (a leak
	* that accumulates one node per ambience/mood crossfade).
	*/
	fadeOut(id, durationMs) {
		const instance = this.instances.get(id);
		if (!instance) return;
		this.fade(id, 0, durationMs);
		instance.fadeStopTimer = setTimeout(() => {
			if (this.instances.get(id) === instance) this.stop(id);
		}, Math.max(0, durationMs));
	}
	clearFadeStop(instance) {
		if (instance.fadeStopTimer !== void 0) {
			clearTimeout(instance.fadeStopTimer);
			instance.fadeStopTimer = void 0;
		}
	}
	stopAll() {
		for (const id of [...this.instances.keys()]) this.stop(id);
	}
	getActiveInstances() {
		return [...this.instances.values()].map(({ id, clipName, loop, volume }) => ({
			id,
			clipName,
			loop,
			volume
		}));
	}
	dispose() {
		this.generation += 1;
		this.loadAbort?.abort();
		this.loadAbort = null;
		this.loadPromise = null;
		this.stopAll();
		this.output?.disconnect();
		this.output = null;
		this.buffer = null;
		this.manifest = null;
		if (this.ctx && this.ctx.state !== "closed") this.ctx.close().catch(() => {});
		this.ctx = null;
	}
	removeInstance(id) {
		const instance = this.instances.get(id);
		if (!instance) return;
		this.clearFadeStop(instance);
		this.instances.delete(id);
		try {
			instance.source.disconnect();
		} catch {}
		try {
			instance.gain.disconnect();
		} catch {}
	}
};
function createAudioSpriteEngine() {
	return new AudioSpriteEngine();
}
//#endregion
//#region src/audio-player/core/audio/usePluginSoundLayer.ts
/**
* Creates the restricted sprite facade passed to plugins. One engine is shared
* by the player/session so plugin-layer sounds never touch primary playback.
*/
function usePluginSoundLayer() {
	const engineRef = useRef(null);
	if (engineRef.current === null) engineRef.current = new AudioSpriteEngine();
	useEffect(() => () => {
		engineRef.current?.dispose();
		engineRef.current = null;
	}, []);
	return useMemo(() => ({
		loadSpritePack: (manifest) => engineRef.current.load(manifest),
		playSprite: (clipName, options) => engineRef.current.play(clipName, options),
		stopSprite: (id) => engineRef.current.stop(id),
		fadeSprite: (id, toVolume, durationMs) => engineRef.current.fade(id, toVolume, durationMs),
		stopAllSprites: () => engineRef.current.stopAll()
	}), []);
}
//#endregion
//#region src/audio-player/session/AudioSessionContext.tsx
var AudioSessionContext = createContext(null);
var EMPTY_PLUGINS$1 = [];
/**
* Build a playback order (a list of queue indices). When shuffle is off this is
* the natural order. When on it is a Fisher–Yates shuffle with `startIndex`
* pulled to the front so the current track keeps playing and the rest are
* randomized — giving shuffle a definite end (so "repeat off" can stop).
*/
function buildOrder(length, startIndex, shuffle) {
	const indices = Array.from({ length }, (_, i) => i);
	if (!shuffle || length <= 1) return indices;
	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}
	const at = indices.indexOf(startIndex);
	if (at > 0) [indices[0], indices[at]] = [indices[at], indices[0]];
	return indices;
}
/**
* Owns the one and only `<audio>` element for the app plus the shared queue.
* Internally reuses `useAudioPlayer` (the proven per-source engine) and drives
* its `src` from the queue index. Every UI skin reads this via `useAudioSession`
* and controls the same playback — so interacting with any skin updates all of
* them, because there is a single audio element behind them.
*/
function AudioSessionProvider({ children, initialQueue = [], initialIndex = 0, autoPlay = false, repeatMode: initialRepeat = "off", shuffle: initialShuffle = false, automix: initialAutomix = false, plugins: externalPlugins = EMPTY_PLUGINS$1, audioBackend = "html5", onFallbackSource, preloadConfig }) {
	const [queue, setQueueState] = useState(initialQueue);
	const [currentIndex, setCurrentIndex] = useState(initialQueue.length > 0 ? Math.min(Math.max(initialIndex, 0), initialQueue.length - 1) : -1);
	const [shuffle, setShuffle] = useState(initialShuffle);
	const [repeatMode, setRepeatMode] = useState(initialRepeat);
	const [automix, setAutomix] = useState(initialAutomix);
	const order = useMemo(() => buildOrder(queue.length, currentIndex < 0 ? 0 : currentIndex, shuffle), [queue, shuffle]);
	const pendingPlayRef = useRef(false);
	const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
	const currentTrackSources = useMemo(() => getTrackSources(currentTrack), [currentTrack]);
	const src = currentTrackSources[0]?.url ?? "";
	const sourceKey = currentTrack ? `${currentIndex}:${trackKey(currentTrack)}:${trackSourcesSignature(currentTrack)}` : "empty";
	const subscribersRef = useRef(/* @__PURE__ */ new Map());
	const subscribe = useCallback((eventType, handler) => {
		let set = subscribersRef.current.get(eventType);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			subscribersRef.current.set(eventType, set);
		}
		set.add(handler);
		return () => {
			set?.delete(handler);
		};
	}, []);
	const emit = useCallback((eventType, payload) => {
		const set = subscribersRef.current.get(eventType);
		if (set) for (const handler of Array.from(set)) handler(payload);
	}, []);
	const handleFallbackSource = useCallback((event) => {
		onFallbackSource?.(event);
		emit("fallback-source", event);
	}, [onFallbackSource, emit]);
	const advanceRef = useRef(() => {});
	const engine = useAudioPlayer({
		src,
		sources: currentTrackSources,
		sourceKey,
		autoPlay,
		loop: repeatMode === "one",
		onEnded: () => advanceRef.current(),
		onFallbackSource: handleFallbackSource,
		audioBackend
	});
	useEffect(() => {
		if (queue.length === 0 && currentIndex !== -1) setCurrentIndex(-1);
		else if (currentIndex >= queue.length) setCurrentIndex(queue.length - 1);
	}, [queue.length, currentIndex]);
	const prevIndexRef = useRef(currentIndex);
	useEffect(() => {
		if (currentIndex !== prevIndexRef.current) {
			emit("track-change", {
				track: currentTrack,
				previousIndex: prevIndexRef.current
			});
			prevIndexRef.current = currentIndex;
		}
	}, [
		currentIndex,
		currentTrack,
		emit
	]);
	const stepIndex = useCallback((from, dir) => {
		if (order.length === 0) return null;
		const pos = order.indexOf(from);
		if (pos === -1) return dir === 1 ? order[0] : null;
		let nextPos = pos + dir;
		if (nextPos >= order.length) if (repeatMode === "all") nextPos = 0;
		else return null;
		else if (nextPos < 0) nextPos = repeatMode === "all" ? order.length - 1 : 0;
		return order[nextPos];
	}, [order, repeatMode]);
	const goTo = useCallback((index, wantPlay) => {
		if (index < 0 || index >= queue.length) return;
		if (index === currentIndex) {
			if (wantPlay && !engine.isPlaying) engine.play(true);
			return;
		}
		if (wantPlay && !engine.isPlaying) pendingPlayRef.current = true;
		setCurrentIndex(index);
	}, [
		queue.length,
		currentIndex,
		engine
	]);
	const advanceToNextRef = useRef(() => {});
	advanceToNextRef.current = () => {
		const next = stepIndex(currentIndex, 1);
		if (next === null) {
			emit("queue-end", { reason: repeatMode === "off" ? "repeat-off" : "normal" });
			return;
		}
		if (next === currentIndex) {
			engine.seek(0);
			engine.play(true);
			return;
		}
		pendingPlayRef.current = true;
		setCurrentIndex(next);
	};
	const requestAdvance = useCallback(() => advanceToNextRef.current(), []);
	const pluginNextIndex = repeatMode !== "one" ? stepIndex(currentIndex, 1) : null;
	const pluginNextTrack = pluginNextIndex !== null && pluginNextIndex !== currentIndex ? queue[pluginNextIndex] ?? null : null;
	const automixPluginRef = useRef(null);
	if (automixPluginRef.current === null) automixPluginRef.current = createAutomixPlugin({
		name: AUTOMIX_PLUGIN_NAME,
		enabled: false
	});
	const hasExternalAutomix = hasAutomixPlugin(externalPlugins);
	const automixEnabled = automix && !hasExternalAutomix;
	useEffect(() => {
		automixPluginRef.current?.updateConfig({ enabled: automixEnabled });
	}, [automixEnabled]);
	const allPlugins = useMemo(() => withInternalAutomix(externalPlugins, automixPluginRef.current), [externalPlugins]);
	const pluginSoundLayer = usePluginSoundLayer();
	const pluginContextStateRef = useRef({
		engine,
		currentTrack,
		nextTrack: pluginNextTrack,
		sourceKey,
		queue,
		currentIndex,
		repeatMode,
		shuffle,
		requestAdvance,
		next: () => {},
		previous: () => {}
	});
	const pluginManager = usePluginManager(allPlugins, useMemo(() => ({
		getEngine: () => pluginContextStateRef.current.engine,
		getRootElement: () => null,
		getAudioElement: () => pluginContextStateRef.current.engine.audioRef.current,
		getCurrentTrack: () => pluginContextStateRef.current.currentTrack,
		getNextTrack: () => pluginContextStateRef.current.nextTrack,
		getSourceKey: () => pluginContextStateRef.current.sourceKey,
		requestAdvance: () => pluginContextStateRef.current.requestAdvance(),
		next: () => pluginContextStateRef.current.next(),
		previous: () => pluginContextStateRef.current.previous(),
		getQueue: () => pluginContextStateRef.current.queue,
		getCurrentIndex: () => pluginContextStateRef.current.currentIndex,
		getRepeatMode: () => pluginContextStateRef.current.repeatMode,
		getShuffle: () => pluginContextStateRef.current.shuffle,
		sounds: pluginSoundLayer
	}), [pluginSoundLayer]));
	const seekWithPlugins = useCallback((time) => {
		const nextPosition = engine.duration > 0 ? Math.max(0, Math.min(engine.duration, time)) : time;
		engine.seek(time);
		pluginManager.trigger("onSeek", nextPosition);
	}, [engine, pluginManager]);
	const seekByWithPlugins = useCallback((delta) => {
		seekWithPlugins((engine.audioRef.current?.currentTime ?? engine.currentTime) + delta);
	}, [
		engine.audioRef,
		engine.currentTime,
		seekWithPlugins
	]);
	const pluginAwareEngine = useMemo(() => ({
		...engine,
		seek: seekWithPlugins,
		seekBy: seekByWithPlugins
	}), [
		engine,
		seekByWithPlugins,
		seekWithPlugins
	]);
	pluginContextStateRef.current = {
		engine: pluginAwareEngine,
		currentTrack,
		nextTrack: pluginNextTrack,
		sourceKey,
		queue,
		currentIndex,
		repeatMode,
		shuffle,
		requestAdvance,
		next: () => {},
		previous: () => {}
	};
	advanceRef.current = () => {
		if (pluginManager.triggerUntilHandled("onTrackEnded", currentTrack)) return;
		advanceToNextRef.current();
	};
	useEffect(() => {
		pluginManager.trigger("onTrackLoad", currentTrack);
	}, [
		pluginManager,
		sourceKey,
		currentTrack
	]);
	const preloadConfigProp = preloadConfig || { strategy: "next" };
	useEffect(() => {
		if (!engine.isPlaying || repeatMode === "one") return;
		const strategy = preloadConfigProp.strategy || "next";
		if (strategy === "none") return;
		if (preloadConfigProp.skipOnCellular && "connection" in navigator) {
			const conn = navigator.connection;
			if (conn.effectiveType === "cellular" || conn.type === "cellular") return;
		}
		if (strategy === "next" && pluginNextTrack) engine.preload(pluginNextTrack);
		else if (strategy === "aggressive") {
			const max = preloadConfigProp.maxConcurrent || 2;
			let current = currentIndex;
			for (let i = 0; i < max; i++) {
				const nextIdx = stepIndex(current, 1);
				if (nextIdx === null || nextIdx === currentIndex) break;
				engine.preload(queue[nextIdx]);
				current = nextIdx;
			}
		}
	}, [
		engine,
		engine.isPlaying,
		pluginNextTrack,
		repeatMode,
		sourceKey,
		preloadConfigProp,
		currentIndex,
		queue,
		stepIndex
	]);
	const previousPluginPlayingRef = useRef(engine.isPlaying);
	useEffect(() => {
		if (previousPluginPlayingRef.current === engine.isPlaying) return;
		previousPluginPlayingRef.current = engine.isPlaying;
		pluginManager.trigger(engine.isPlaying ? "onPlay" : "onPause");
		if (engine.isPlaying) emit("play", {
			track: currentTrack,
			currentTime: engine.currentTime
		});
		else emit("pause", {
			track: currentTrack,
			currentTime: engine.currentTime
		});
	}, [
		pluginManager,
		engine.isPlaying,
		engine.currentTime,
		currentTrack,
		emit
	]);
	useEffect(() => {
		pluginManager.trigger("onTimeUpdate", engine.currentTime);
	}, [pluginManager, engine.currentTime]);
	const prevErrorRef = useRef(engine.hasError);
	useEffect(() => {
		if (engine.hasError && !prevErrorRef.current) emit("error", {
			error: engine.errorMessage,
			track: currentTrack
		});
		prevErrorRef.current = engine.hasError;
	}, [
		engine.hasError,
		engine.errorMessage,
		currentTrack,
		emit
	]);
	useEffect(() => {
		if (!engine.hasAudio || queue.length === 0) pluginManager.trigger("onStop");
	}, [
		pluginManager,
		engine.hasAudio,
		queue.length
	]);
	useEffect(() => () => {
		pluginManager.trigger("onStop");
	}, [pluginManager]);
	useEffect(() => {
		if (pendingPlayRef.current) {
			pendingPlayRef.current = false;
			if (engine.currentSrc) engine.play(true);
		}
	}, [sourceKey, engine.currentSrc]);
	const setQueue = useCallback((tracks, startIndex = 0, autoPlayNext = false) => {
		const idx = tracks.length > 0 ? Math.min(Math.max(startIndex, 0), tracks.length - 1) : -1;
		if (autoPlayNext && idx >= 0 && !engine.isPlaying) pendingPlayRef.current = true;
		setQueueState(tracks);
		setCurrentIndex(idx);
	}, [engine.isPlaying]);
	const playTrack = useCallback((index) => goTo(index, true), [goTo]);
	const enqueue = useCallback((track) => {
		setQueueState((q) => [...q, track]);
	}, []);
	const playNow = useCallback((track) => {
		const key = trackKey(track);
		const existing = queue.findIndex((t) => trackKey(t) === key);
		if (existing !== -1) {
			if (queue[existing] !== track) {
				setQueueState((q) => q.map((t, i) => i === existing ? track : t));
				if (existing === currentIndex) {
					const sourceChanged = getPrimaryTrackSource(track) !== src;
					if (!engine.isPlaying) if (sourceChanged) pendingPlayRef.current = true;
					else engine.play(true);
					return;
				}
			}
			goTo(existing, true);
			return;
		}
		const nextIndex = queue.length;
		if (!engine.isPlaying) pendingPlayRef.current = true;
		setQueueState((q) => [...q, track]);
		setCurrentIndex(nextIndex);
	}, [
		queue,
		goTo,
		engine,
		currentIndex,
		src
	]);
	const next = useCallback(() => {
		const target = stepIndex(currentIndex, 1);
		if (target !== null) goTo(target, engine.isPlaying);
	}, [
		stepIndex,
		currentIndex,
		goTo,
		engine.isPlaying
	]);
	const previous = useCallback(() => {
		if (engine.currentTime > 3) {
			seekWithPlugins(0);
			return;
		}
		const target = stepIndex(currentIndex, -1);
		if (target !== null) goTo(target, engine.isPlaying);
	}, [
		stepIndex,
		currentIndex,
		goTo,
		engine.currentTime,
		engine.isPlaying,
		seekWithPlugins
	]);
	const moveQueueItem = useCallback((fromIndex, toIndex) => {
		if (fromIndex === toIndex) return;
		if (fromIndex < 0 || fromIndex >= queue.length) return;
		if (toIndex < 0 || toIndex >= queue.length) return;
		setQueueState((q) => {
			const next = [...q];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			if (fromIndex === currentIndex) {} else {
				let adjusted = currentIndex;
				if (fromIndex < currentIndex && toIndex >= currentIndex) adjusted = currentIndex - 1;
				else if (fromIndex > currentIndex && toIndex <= currentIndex) adjusted = currentIndex + 1;
				if (adjusted !== currentIndex) queueMicrotask(() => setCurrentIndex(adjusted));
			}
			return next;
		});
		if (fromIndex === currentIndex) queueMicrotask(() => setCurrentIndex(toIndex));
	}, [queue.length, currentIndex]);
	const removeFromQueue = useCallback((index) => {
		if (index < 0 || index >= queue.length) return;
		if (index === currentIndex) return;
		setQueueState((q) => {
			const next = [...q];
			next.splice(index, 1);
			return next;
		});
		if (index < currentIndex) setCurrentIndex((ci) => ci - 1);
	}, [queue.length, currentIndex]);
	pluginContextStateRef.current = {
		engine: pluginAwareEngine,
		currentTrack,
		nextTrack: pluginNextTrack,
		sourceKey,
		queue,
		currentIndex,
		repeatMode,
		shuffle,
		requestAdvance,
		next,
		previous
	};
	const clearQueue = useCallback(() => {
		engine.pause();
		setQueueState([]);
		setCurrentIndex(-1);
	}, [engine]);
	const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
	const cycleRepeat = useCallback(() => {
		setRepeatMode((r) => r === "off" ? "all" : r === "all" ? "one" : "off");
	}, []);
	const toggleAutomix = useCallback(() => setAutomix((v) => !v), []);
	const canNext = stepIndex(currentIndex, 1) !== null;
	const canPrevious = queue.length > 1 || engine.currentTime > 3;
	const getCacheStats = useCallback(() => {
		const stats = sharedAudioBufferCache.getStats();
		const html5Stats = sharedHTML5AudioPool.getStats();
		return {
			...stats,
			preloadElementCount: html5Stats.preloadElementCount
		};
	}, []);
	const pruneAudioCache = useCallback((keepRecent = 0) => {
		const keepKeys = queue.map((t, i) => `${i}:${trackKey(t)}:${trackSourcesSignature(t)}`);
		sharedAudioBufferCache.prune(keepKeys, keepRecent);
	}, [queue]);
	const setCacheLimit = useCallback((maxBuffers) => {
		sharedAudioBufferCache.setMaxSize(maxBuffers);
	}, []);
	const value = useMemo(() => ({
		...pluginAwareEngine,
		queue,
		currentIndex,
		currentTrack,
		shuffle,
		repeatMode,
		automix,
		canNext,
		canPrevious,
		setQueue,
		playTrack,
		enqueue,
		playNow,
		next,
		previous,
		clearQueue,
		moveQueueItem,
		removeFromQueue,
		toggleShuffle,
		cycleRepeat,
		toggleAutomix,
		subscribe,
		getCacheStats,
		pruneAudioCache,
		setCacheLimit
	}), [
		pluginAwareEngine,
		queue,
		currentIndex,
		currentTrack,
		shuffle,
		repeatMode,
		automix,
		canNext,
		canPrevious,
		setQueue,
		playTrack,
		enqueue,
		playNow,
		next,
		previous,
		clearQueue,
		moveQueueItem,
		removeFromQueue,
		toggleShuffle,
		cycleRepeat,
		toggleAutomix,
		subscribe,
		getCacheStats,
		pruneAudioCache,
		setCacheLimit
	]);
	return /* @__PURE__ */ jsxs(AudioSessionContext.Provider, {
		value,
		children: [engine.getBackendInfo().active === "html5" && /* @__PURE__ */ jsx("audio", {
			ref: engine.audioRef,
			src: engine.currentSrc || void 0
		}), children]
	});
}
/** Read the global audio session. Throws if used outside an AudioSessionProvider. */
function useAudioSession() {
	const ctx = useContext(AudioSessionContext);
	if (!ctx) throw new Error("useAudioSession must be used within an <AudioSessionProvider>");
	return ctx;
}
//#endregion
//#region src/audio-player/headless/useMediaSessionObserver.ts
/**
* Build a Media Session artwork array with multiple sizes from a single URL.
* The OS picks the best size for its display (e.g. iOS lock screen).
*/
function buildMediaSessionArtwork(src) {
	const type = /\.png$/i.test(src) ? "image/png" : "image/jpeg";
	return [{
		src,
		sizes: "512x512",
		type
	}, {
		src,
		sizes: "1024x1024",
		type
	}];
}
/** Pull a bare URL out of a CSS `url("…")` value, if it is one. */
function extractUrlFromCss(css) {
	const m = css.match(/url\(["']?([^"')]+)["']?\)/);
	return m ? m[1] : null;
}
/**
* Resolve an artwork candidate (a track/background source) to a bare image URL
* usable as Media Session artwork, or `undefined` when it isn't a real image.
*
* Callers may pass a plain URL or a raw CSS value. A `url("…")` wrapper is
* unwrapped; a gradient (or any other CSS function) is rejected so a non-image
* background never yields a malformed `MediaImage` the OS can't render.
*/
function resolveArtworkSrc(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	if (!trimmed) return void 0;
	const fromCss = extractUrlFromCss(trimmed);
	if (fromCss) return fromCss;
	if (/^[a-z-]+\(/i.test(trimmed)) return void 0;
	return trimmed;
}
/**
* Media Session API integration (progressive enhancement) as a reusable hook,
* so any skin — the built-in `AudioPlayer` or a custom headless one — gets
* lock-screen metadata and OS media controls from the same engine.
*
* Does nothing (silently) when the browser has no `navigator.mediaSession`.
*
* IMPORTANT: metadata is *not* cleared on dependency changes — doing so
* causes iOS to briefly lose artwork on track transitions. The new metadata
* overwrites the previous entry directly.
*/
function useMediaSessionObserver(engine, options) {
	const latest = useRef({
		engine,
		options
	});
	latest.current = {
		engine,
		options
	};
	useEffect(() => {
		if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
		const ms = navigator.mediaSession;
		ms.metadata = new MediaMetadata({
			title: options.title,
			artist: options.artist ?? "",
			album: options.album ?? "",
			artwork: options.artwork ?? []
		});
	}, [
		options.title,
		options.artist,
		options.album,
		options.artwork
	]);
	useEffect(() => {
		if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
		const ms = navigator.mediaSession;
		const actions = [
			"play",
			"pause",
			"previoustrack",
			"nexttrack",
			"seekbackward",
			"seekforward",
			"stop"
		];
		const handlers = {
			play: () => latest.current.engine.play(true),
			pause: () => latest.current.engine.pause(),
			previoustrack: () => latest.current.options.onPrevious?.(),
			nexttrack: () => latest.current.options.onNext?.(),
			seekbackward: () => {
				const step = latest.current.options.seekStep ?? 10;
				latest.current.engine.seekBy(-step);
			},
			seekforward: () => {
				const step = latest.current.options.seekStep ?? 10;
				latest.current.engine.seekBy(step);
			},
			stop: () => latest.current.engine.pause()
		};
		for (const action of actions) try {
			ms.setActionHandler(action, handlers[action]);
		} catch {}
		return () => {
			for (const action of actions) try {
				ms.setActionHandler(action, null);
			} catch {}
		};
	}, []);
	useEffect(() => {
		if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
		navigator.mediaSession.playbackState = engine.isPlaying ? "playing" : "paused";
	}, [engine.isPlaying]);
}
//#endregion
//#region src/audio-player/utils/formatTime.ts
/** Format a number of seconds as `m:ss`. Returns `0:00` for invalid input. */
function formatTime(time) {
	if (!Number.isFinite(time) || time < 0) return "0:00";
	return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, "0")}`;
}
//#endregion
//#region src/audio-player/components/ProgressBar.tsx
/**
* Fully custom, div-based scrubber. A single Pointer Events pipeline handles
* mouse, touch, and pen identically (no separate touch path), which removes the
* dual-system jank of a native <input type="range">. Keyboard accessibility is
* re-implemented here since we no longer get it from the native control.
*
* During a drag, the thumb/fill update locally at full frame rate without
* touching the <audio> element. The final seek is applied once on pointer up,
* preventing repeated seeks at 60-120Hz from causing audio stutter or decode lag.
*
* Unmount safety: pointer capture is tracked in a ref and released in a
* `useEffect` cleanup so a drag that ends in an unmount cannot leak a captured
* pointer back to the document.
*/
function ProgressBar({ currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd }) {
	const trackRef = useRef(null);
	const dragTimeRef = useRef(null);
	/**
	* Captured pointer bookkeeping. `captureId` is the pointer id we asked the
	* browser to capture; `captureTarget` is the element that owns the
	* capture. The unmount effect calls `releasePointerCapture` on the stored
	* target so a mid-drag unmount never leaves the browser with a dangling
	* capture pointing at a detached node.
	*/
	const captureIdRef = useRef(null);
	const captureTargetRef = useRef(null);
	const [dragTime, setDragTime] = useState(null);
	const ratioFromEvent = useCallback((clientX) => {
		const el = trackRef.current;
		if (!el) return 0;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0) return 0;
		return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
	}, []);
	const releaseCapture = useCallback(() => {
		const target = captureTargetRef.current;
		const id = captureIdRef.current;
		if (target !== null && id !== null) try {
			if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
		} catch {}
		captureTargetRef.current = null;
		captureIdRef.current = null;
	}, []);
	const handlePointerDown = useCallback((event) => {
		if (disabled || duration <= 0 || event.button !== 0) return;
		const target = event.currentTarget;
		try {
			target.setPointerCapture(event.pointerId);
		} catch {}
		captureTargetRef.current = target;
		captureIdRef.current = event.pointerId;
		const time = ratioFromEvent(event.clientX) * duration;
		dragTimeRef.current = time;
		setDragTime(time);
		onSeekStart();
		onSeek(time);
	}, [
		disabled,
		duration,
		onSeek,
		onSeekStart,
		ratioFromEvent
	]);
	const handlePointerMove = useCallback((event) => {
		if (disabled || duration <= 0) return;
		if (captureIdRef.current === null || event.pointerId !== captureIdRef.current) return;
		const time = ratioFromEvent(event.clientX) * duration;
		dragTimeRef.current = time;
		setDragTime(time);
	}, [
		disabled,
		duration,
		ratioFromEvent
	]);
	const handlePointerUp = useCallback((event) => {
		const id = captureIdRef.current;
		if (id === null || event.pointerId !== id) return;
		if (dragTimeRef.current !== null) onSeek(dragTimeRef.current);
		releaseCapture();
		dragTimeRef.current = null;
		setDragTime(null);
		onSeekEnd();
	}, [
		onSeek,
		onSeekEnd,
		releaseCapture
	]);
	const handleKeyDown = useCallback((event) => {
		if (disabled || duration <= 0) return;
		let next = null;
		const step = event.shiftKey ? 30 : 5;
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				next = currentTime + step;
				break;
			case "ArrowLeft":
			case "ArrowDown":
				next = currentTime - step;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = duration;
				break;
			case "PageUp":
				next = currentTime + 10;
				break;
			case "PageDown":
				next = currentTime - 10;
				break;
			default: return;
		}
		event.preventDefault();
		onSeek(next);
	}, [
		currentTime,
		disabled,
		duration,
		onSeek
	]);
	useEffect(() => {
		return () => {
			releaseCapture();
		};
	}, [releaseCapture]);
	const displayTime = dragTime !== null ? dragTime : currentTime;
	const rawProgressPct = duration > 0 ? displayTime / duration * 100 : 0;
	const rawBufferedPct = duration > 0 ? buffered / duration * 100 : 0;
	const clampPct = (v) => Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
	const progressPct = clampPct(rawProgressPct);
	const bufferedPct = clampPct(rawBufferedPct);
	const ariaValueNow = Number.isFinite(displayTime) && displayTime > 0 ? Math.round(displayTime * 10) / 10 : 0;
	return /* @__PURE__ */ jsxs("div", {
		ref: trackRef,
		className: `ap-progress${isSeeking ? " ap-progress--seeking" : ""}`,
		role: "slider",
		tabIndex: disabled ? -1 : 0,
		"aria-label": disabled ? "Seek unavailable. Audio file missing" : "Seek",
		"aria-valuemin": 0,
		"aria-valuemax": Math.floor(duration),
		"aria-valuenow": ariaValueNow,
		"aria-valuetext": `${formatTime(displayTime)} of ${formatTime(duration)}`,
		"aria-disabled": disabled,
		onPointerDown: handlePointerDown,
		onPointerMove: handlePointerMove,
		onPointerUp: handlePointerUp,
		onPointerCancel: handlePointerUp,
		onKeyDown: handleKeyDown,
		children: [
			/* @__PURE__ */ jsx("div", { className: "ap-progress__track" }),
			/* @__PURE__ */ jsx("div", {
				className: "ap-progress__buffered",
				style: { width: `${bufferedPct}%` }
			}),
			/* @__PURE__ */ jsx("div", {
				className: "ap-progress__fill",
				style: { width: `${progressPct}%` }
			}),
			/* @__PURE__ */ jsx("div", {
				className: "ap-progress__thumb",
				style: { left: `${progressPct}%` }
			})
		]
	});
}
//#endregion
//#region src/audio-player/core/waveform/peaks.ts
/**
* Waveform peak extraction. Produces the `peaks` arrays wavesurfer.js accepts
* (per-channel 0–1 amplitudes) from decoded PCM, plus a fetch+decode fallback
* for backends that stream and never hold decoded data.
*/
/** Fixed bucket count: render cost stays constant regardless of track length. */
var DEFAULT_BUCKETS = 1024;
/**
* Reduce an AudioBuffer to a single merged-mono peaks channel: the abs-max
* sample per bucket across up to two channels. wavesurfer renders a single
* channel as a symmetric waveform, and `normalize: true` handles scaling.
*/
function extractPeaks(buffer, buckets = DEFAULT_BUCKETS) {
	const length = buffer.length;
	if (length === 0 || buckets <= 0) return [[]];
	const bucketCount = Math.min(buckets, length);
	const step = length / bucketCount;
	const channels = [];
	for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) channels.push(buffer.getChannelData(c));
	const merged = new Array(bucketCount);
	for (let i = 0; i < bucketCount; i++) {
		const start = Math.floor(i * step);
		const end = Math.min(length, Math.floor((i + 1) * step) || start + 1);
		let max = 0;
		for (const data of channels) for (let j = start; j < end; j++) {
			const value = Math.abs(data[j]);
			if (value > max) max = value;
		}
		merged[i] = max;
	}
	return [merged];
}
/**
* Decoded-peaks LRU keyed by URL so StrictMode remounts, track revisits, and
* retries never re-download or re-decode. Stores only the reduced peaks
* (~8KB each), not the PCM.
*/
var peaksCache = /* @__PURE__ */ new Map();
var PEAKS_CACHE_LIMIT = 10;
var inFlight = /* @__PURE__ */ new Map();
function cachePut(url, value) {
	peaksCache.delete(url);
	peaksCache.set(url, value);
	while (peaksCache.size > PEAKS_CACHE_LIMIT) {
		const oldest = peaksCache.keys().next().value;
		if (oldest === void 0) break;
		peaksCache.delete(oldest);
	}
}
/**
* Fetch and decode an audio URL into waveform peaks. Used as the fallback for
* the html5 backend, where no decoded data exists — note this downloads the
* file a second time and requires CORS on remote sources.
*
* Decodes through a throwaway OfflineAudioContext so it never consumes the
* shared playback AudioContext.
*/
async function computePeaksFromUrl(url, signal) {
	const cached = peaksCache.get(url);
	if (cached) {
		cachePut(url, cached);
		return cached;
	}
	const pending = inFlight.get(url);
	if (pending) return pending;
	const run = (async () => {
		try {
			const response = await fetch(url, { signal });
			if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
			const data = await response.arrayBuffer();
			const buffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
			const result = {
				peaks: extractPeaks(buffer),
				duration: buffer.duration
			};
			cachePut(url, result);
			return result;
		} finally {
			inFlight.delete(url);
		}
	})();
	inFlight.set(url, run);
	return run;
}
//#endregion
//#region src/audio-player/components/WaveformProgress.tsx
/** Resolve a color prop, falling back to a CSS custom property on the wrapper
* (canvas fillStyle cannot evaluate `var()` strings). Explicit `var(--x)`
* values are resolved against the wrapper's computed style too. */
function resolveColor(el, explicit, cssVar, fallback) {
	if (explicit) {
		if (!explicit.includes("var(")) return explicit;
		const match = explicit.match(/var\(\s*([^,)]+)/);
		if (match?.[1]) {
			const resolved = getComputedStyle(el).getPropertyValue(match[1].trim()).trim();
			if (resolved) return resolved;
		}
	}
	return getComputedStyle(el).getPropertyValue(cssVar).trim() || fallback;
}
/**
* Waveform scrubber rendered by wavesurfer.js. The engine remains the only
* playback owner: wavesurfer is created with pre-resolved `peaks` + `duration`
* only (never a URL or media element), progress is pushed in via `setTime`,
* and click/drag interactions are forwarded out through the same
* onSeek/onSeekStart/onSeekEnd contract as ProgressBar.
*
* While peaks are loading — or when they cannot be produced at all — the
* regular ProgressBar renders in the same fixed-height slot, so scrubbing
* always works and the layout never shifts.
*/
function WaveformProgress({ currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, peaks, peaksDuration, getDecodedData, url, sourceKey, height = 48, waveColor, progressColor, cursorColor }) {
	const wrapperRef = useRef(null);
	const containerRef = useRef(null);
	const wsRef = useRef(null);
	const draggingRef = useRef(false);
	const lastDragEndRef = useRef(0);
	const [status, setStatus] = useState("pending");
	const onSeekRef = useRef(onSeek);
	onSeekRef.current = onSeek;
	const onSeekStartRef = useRef(onSeekStart);
	onSeekStartRef.current = onSeekStart;
	const onSeekEndRef = useRef(onSeekEnd);
	onSeekEndRef.current = onSeekEnd;
	const durationRef = useRef(duration);
	durationRef.current = duration;
	const currentTimeRef = useRef(currentTime);
	currentTimeRef.current = currentTime;
	useEffect(() => {
		let cancelled = false;
		setStatus("pending");
		const resolvePeaks = async () => {
			if (peaks && peaks.length > 0 && (peaks[0]?.length ?? 0) > 0) {
				const d = peaksDuration ?? durationRef.current;
				if (d > 0) return {
					peaks,
					duration: d
				};
			}
			const decoded = getDecodedData?.();
			if (decoded) return {
				peaks: extractPeaks(decoded),
				duration: decoded.duration
			};
			if (url && url.trim().length > 0) return await computePeaksFromUrl(url);
			return null;
		};
		const run = async () => {
			try {
				const resolved = await resolvePeaks();
				if (cancelled) return;
				if (!resolved) return;
				const WaveSurferCtor = (await import("wavesurfer.js")).default;
				if (cancelled) return;
				const container = containerRef.current;
				const wrapper = wrapperRef.current;
				if (!container || !wrapper) return;
				wsRef.current?.destroy();
				container.innerHTML = "";
				const ws = WaveSurferCtor.create({
					container,
					peaks: resolved.peaks,
					duration: resolved.duration,
					height,
					normalize: true,
					interact: true,
					dragToSeek: false,
					barWidth: 2,
					barGap: 1,
					barRadius: 2,
					cursorWidth: 2,
					waveColor: resolveColor(wrapper, waveColor, "--ap-track", "rgba(204, 204, 204, 0.35)"),
					progressColor: resolveColor(wrapper, progressColor, "--ap-progress", "#FFFFFF"),
					cursorColor: resolveColor(wrapper, cursorColor, "--ap-accent", "#FFFFFF")
				});
				ws.on("dragstart", () => {
					draggingRef.current = true;
					onSeekStartRef.current();
				});
				ws.on("dragend", (relativeX) => {
					draggingRef.current = false;
					lastDragEndRef.current = performance.now();
					onSeekRef.current(relativeX * durationRef.current);
					onSeekEndRef.current();
				});
				ws.on("click", (relativeX) => {
					if (performance.now() - lastDragEndRef.current < 80) return;
					onSeekStartRef.current();
					onSeekRef.current(relativeX * durationRef.current);
					onSeekEndRef.current();
				});
				wsRef.current = ws;
				ws.setTime(currentTimeRef.current);
				setStatus("ready");
			} catch {
				if (!cancelled) setStatus("failed");
			}
		};
		run();
		return () => {
			cancelled = true;
			draggingRef.current = false;
			wsRef.current?.destroy();
			wsRef.current = null;
		};
	}, [
		sourceKey ?? url ?? "",
		duration > 0,
		peaks,
		peaksDuration,
		url,
		getDecodedData
	]);
	const rafIdRef = useRef(0);
	const lastPushedRef = useRef(-1);
	useEffect(() => {
		if (!wsRef.current || status !== "ready" || draggingRef.current) return;
		if (Math.abs(currentTime - lastPushedRef.current) < .01) return;
		if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
		rafIdRef.current = requestAnimationFrame(() => {
			rafIdRef.current = 0;
			const wsCurrent = wsRef.current;
			if (!wsCurrent || draggingRef.current) return;
			lastPushedRef.current = currentTime;
			wsCurrent.setTime(currentTime);
		});
		return () => {
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = 0;
			}
		};
	}, [currentTime, status]);
	useEffect(() => {
		const ws = wsRef.current;
		const wrapper = wrapperRef.current;
		if (!ws || !wrapper || status !== "ready") return;
		ws.setOptions({
			height,
			waveColor: resolveColor(wrapper, waveColor, "--ap-track", "rgba(204, 204, 204, 0.35)"),
			progressColor: resolveColor(wrapper, progressColor, "--ap-progress", "#FFFFFF"),
			cursorColor: resolveColor(wrapper, cursorColor, "--ap-accent", "#FFFFFF")
		});
	}, [
		height,
		waveColor,
		progressColor,
		cursorColor,
		status
	]);
	const handleKeyDown = (event) => {
		if (disabled || duration <= 0) return;
		let next = null;
		const step = event.shiftKey ? 30 : 5;
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				next = currentTime + step;
				break;
			case "ArrowLeft":
			case "ArrowDown":
				next = currentTime - step;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = duration;
				break;
			case "PageUp":
				next = currentTime + 10;
				break;
			case "PageDown":
				next = currentTime - 10;
				break;
			default: return;
		}
		event.preventDefault();
		onSeek(next);
	};
	const showWave = status === "ready" && !disabled && duration > 0;
	const ariaValueNow = Number.isFinite(currentTime) && currentTime > 0 ? Math.round(currentTime * 10) / 10 : 0;
	const clampPct = (v) => Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
	const bufferedPct = clampPct(duration > 0 ? buffered / duration * 100 : 0);
	return /* @__PURE__ */ jsxs("div", {
		ref: wrapperRef,
		className: `ap-waveform${isSeeking ? " ap-waveform--seeking" : ""}`,
		style: { height: `${height}px` },
		children: [/* @__PURE__ */ jsxs("div", {
			className: "ap-waveform__surface",
			role: "slider",
			tabIndex: showWave ? 0 : -1,
			"aria-label": "Seek",
			"aria-valuemin": 0,
			"aria-valuemax": Math.floor(duration),
			"aria-valuenow": ariaValueNow,
			"aria-valuetext": `${formatTime(currentTime)} of ${formatTime(duration)}`,
			"aria-disabled": disabled,
			onKeyDown: handleKeyDown,
			style: { visibility: showWave ? "visible" : "hidden" },
			children: [/* @__PURE__ */ jsx("div", {
				ref: containerRef,
				className: "ap-waveform__canvas"
			}), /* @__PURE__ */ jsx("div", {
				className: "ap-waveform__buffered",
				style: { width: `${bufferedPct}%` }
			})]
		}), !showWave && /* @__PURE__ */ jsx("div", {
			className: "ap-waveform__fallback",
			children: /* @__PURE__ */ jsx(ProgressBar, {
				currentTime,
				duration,
				buffered,
				disabled,
				isSeeking,
				onSeek,
				onSeekStart,
				onSeekEnd
			})
		})]
	});
}
//#endregion
//#region src/audio-player/surfaces/faceCapabilities.ts
/**
* Family-level capability defaults. A face declares its `family` and overrides
* only the handful of fields where it diverges, so the contract lives in one
* place per family instead of being re-spelled per face.
*/
var FAMILY_DEFAULTS = {
	primary: {
		supportsSEICanvas: true,
		supportsAction: true,
		supportsScrubberCanvas: true,
		supportsWaveform: true,
		supportsContextualActions: true,
		supportsHeroCollapse: true,
		preferredCanvasPlacement: "main",
		scrubberDensity: "standard"
	},
	compact: {
		supportsSEICanvas: false,
		supportsAction: true,
		supportsScrubberCanvas: false,
		supportsWaveform: false,
		supportsContextualActions: false,
		supportsHeroCollapse: false,
		preferredCanvasPlacement: "none",
		scrubberDensity: "compact"
	},
	narrative: {
		supportsSEICanvas: false,
		supportsAction: false,
		supportsScrubberCanvas: false,
		supportsWaveform: false,
		supportsContextualActions: false,
		supportsHeroCollapse: false,
		preferredCanvasPlacement: "none",
		scrubberDensity: "compact"
	}
};
var PLAYER_FACE_CAPABILITIES = Object.fromEntries(Object.entries({
	fullCard: { family: "primary" },
	portable: {
		family: "primary",
		scrubberDensity: "expanded"
	},
	seaCard: {
		family: "primary",
		supportsContextualActions: false,
		preferredCanvasPlacement: "overlay"
	},
	miniSidebar: {
		family: "compact",
		supportsContextualActions: true
	},
	stickyBottom: {
		family: "compact",
		supportsScrubberCanvas: true
	},
	vaultRow: { family: "compact" },
	narrative: { family: "narrative" }
}).map(([face, def]) => {
	const { family, ...overrides } = def;
	return [face, {
		family,
		...FAMILY_DEFAULTS[family],
		...overrides
	}];
}));
function getFaceCapability(face) {
	return PLAYER_FACE_CAPABILITIES[face];
}
/** The family a face belongs to (primary | compact). */
function getFaceFamily(face) {
	return getFaceCapability(face).family;
}
/** Whether a face renders its own action button (the per-face action entry). */
function faceSupportsAction(face) {
	return getFaceCapability(face).supportsAction;
}
function faceSupportsSEICanvas(face) {
	return getFaceCapability(face).supportsSEICanvas;
}
function faceSupportsScrubberCanvas(face) {
	return getFaceCapability(face).supportsScrubberCanvas;
}
function faceSupportsContextualActions(face) {
	return getFaceCapability(face).supportsContextualActions;
}
function faceSupportsWaveform(face) {
	return getFaceCapability(face).supportsWaveform;
}
/**
* Pixel height for the waveform canvas at a given scrubber density. Compact
* faces draw a shorter wave; the standalone/expanded faces get the full height.
* Callers may still override with an explicit `height` prop.
*/
function getScrubberHeight(density) {
	switch (density) {
		case "compact": return 28;
		case "expanded": return 64;
		default: return 48;
	}
}
function faceSupportsHeroCollapse(face) {
	return getFaceCapability(face).supportsHeroCollapse ?? false;
}
function getScrubberDensity(face) {
	return getFaceCapability(face).scrubberDensity ?? "standard";
}
function getPreferredCanvasPlacement(face) {
	return getFaceCapability(face).preferredCanvasPlacement ?? "none";
}
//#endregion
//#region src/audio-player/components/WaveformAdapter.tsx
/**
* The single, session-agnostic bridge between a scrubber zone and its content.
* It chooses the waveform (`WaveformProgress`) or the plain `ProgressBar` from
* the face capability (overridable via `waveform`), so every face — session-based
* or the standalone player — renders the same scrubber through one component.
*
* It owns no playback state: all seeking flows out through the same
* onSeek/onSeekStart/onSeekEnd contract as `ProgressBar`. `WaveformProgress`
* already falls back to a `ProgressBar` internally while peaks load or when none
* can be produced, so the timeline always works and never shifts layout.
*/
function WaveformAdapter({ face, density, currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, peaks, peaksDuration, getDecodedData, url, sourceKey, height, waveColor, progressColor, cursorColor, waveform }) {
	if (!(waveform ?? faceSupportsWaveform(face))) return /* @__PURE__ */ jsx(ProgressBar, {
		currentTime,
		duration,
		buffered,
		disabled,
		isSeeking,
		onSeek,
		onSeekStart,
		onSeekEnd
	});
	return /* @__PURE__ */ jsx(WaveformProgress, {
		currentTime,
		duration,
		buffered,
		disabled,
		isSeeking,
		onSeek,
		onSeekStart,
		onSeekEnd,
		peaks,
		peaksDuration,
		getDecodedData,
		url,
		sourceKey,
		height: height ?? getScrubberHeight(density),
		waveColor,
		progressColor,
		cursorColor
	});
}
//#endregion
//#region src/audio-player/components/BackgroundMedia.tsx
/** Map the new media prop and the legacy props onto a single normalized shape. */
function resolveMedia(input) {
	const { media, legacyImage, legacyCss } = input;
	if (media && media.src) {
		if (media.kind === "video") return {
			media,
			cssBackground: null
		};
		return {
			media: null,
			cssBackground: `url("${media.src}")`
		};
	}
	if (legacyImage?.src) return {
		media: null,
		cssBackground: `url("${legacyImage.src}")`
	};
	if (legacyCss && legacyCss.trim()) return {
		media: null,
		cssBackground: legacyCss
	};
	return {
		media: null,
		cssBackground: null
	};
}
/**
* Force the `muted` DOM property on a `<video>`. React's `muted` prop is applied
* as a property and is unreliable on first paint, which can block autoplay; a ref
* that sets `el.muted = true` guarantees it before the browser evaluates autoplay.
*/
function ensureMuted(el) {
	if (el) el.muted = true;
}
/**
* The shared background/artwork media renderer used across faces. Renders a
* muted, looping `<video>` for video media (visual-only — the engine `<audio>`
* stays the sole audio owner) or the existing `.ap-bg-image` div for an image /
* gradient, plus the optional darken overlay. Blur is inherited from the
* `--ap-blur` CSS variable the face root sets, so callers don't pass it here.
* Returns `null` when there is nothing to render.
*/
function BackgroundMedia({ media, cssBackground, darkenAmount = 0, className }) {
	const darken = darkenAmount > 0 ? /* @__PURE__ */ jsx("div", {
		className: "ap-bg-darken",
		style: { backgroundColor: `rgba(0,0,0,${darkenAmount / 100})` },
		"aria-hidden": "true"
	}) : null;
	if (media && media.kind === "video") {
		const style = media.fit === "contain" ? { objectFit: "contain" } : void 0;
		return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("video", {
			className: `ap-bg-video${className ? ` ${className}` : ""}`,
			src: media.src,
			poster: media.poster,
			ref: ensureMuted,
			muted: true,
			autoPlay: media.autoPlay ?? true,
			loop: media.loop ?? true,
			playsInline: true,
			preload: "metadata",
			"aria-hidden": "true",
			style
		}), darken] });
	}
	if (cssBackground) return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: `ap-bg-image${className ? ` ${className}` : ""}`,
		style: { backgroundImage: cssBackground },
		"aria-hidden": "true"
	}), darken] });
	return null;
}
//#endregion
//#region src/audio-player/surfaces/ScrubberCanvasHost.tsx
/**
* The timeline render zone (ScrubberCanvas). Available on every face; density
* adapts the layout. It owns only chrome/layout — seeking flows straight through
* `onSeek`. The default fallback is the existing ProgressBar.
*
* The stable `[data-scrubber-host]` container is the future plugin mount point.
*/
function ScrubberCanvasHost({ face, density, currentTime, duration, progress, onSeek, activeSurfaceId, children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "ap-scrubber-host",
		"data-scrubber-host": "",
		"data-density": density,
		"data-face": face,
		"data-surface-id": activeSurfaceId,
		"data-progress": Math.round(progress * 100),
		children: children ?? /* @__PURE__ */ jsx(FallbackScrubber, {
			currentTime,
			duration,
			onSeek
		})
	});
}
/**
* Internal default used when a face has no bespoke scrubber to pass in (e.g. the
* mini sidebar, which had no progress bar before). Manages its own seeking state
* so the mission's host prop signature stays minimal.
*/
function FallbackScrubber({ currentTime, duration, onSeek }) {
	const [isSeeking, setIsSeeking] = useState(false);
	return /* @__PURE__ */ jsx(ProgressBar, {
		currentTime,
		duration,
		buffered: 0,
		disabled: duration <= 0,
		isSeeking,
		onSeek,
		onSeekStart: () => setIsSeeking(true),
		onSeekEnd: () => setIsSeeking(false)
	});
}
//#endregion
//#region src/audio-player/surfaces/surfaceReducer.ts
var INITIAL_SURFACE_STATE = { mode: "default" };
/** Canvas mode is only legal on faces that DECLARE SEICanvas support. */
function canEnterCanvas(face) {
	return faceSupportsSEICanvas(face);
}
/**
* Pure surface transition. `face` is passed in so capability is enforced in one
* place: a request to enter canvas on an unsupported face is a no-op.
*/
function surfaceReducer(state, action, face) {
	switch (action.type) {
		case "toggleCanvas":
			if (!canEnterCanvas(face)) return state;
			return { mode: state.mode === "canvas" ? "default" : "canvas" };
		case "toggleQueue": return { mode: state.mode === "queue" ? "default" : "queue" };
		case "open":
			if (action.mode === "canvas" && !canEnterCanvas(face)) return state;
			if (state.mode === action.mode) return state;
			return { mode: action.mode };
		case "close":
			if (state.mode === "default") return state;
			return INITIAL_SURFACE_STATE;
		default: return state;
	}
}
/**
* Whether the hero should render collapsed. True only when the canvas surface is
* open AND the face declares hero-collapse support — derived, never stored, so
* it can't drift from `mode`.
*/
function deriveHeroCollapsed(mode, face) {
	return mode === "canvas" && faceSupportsHeroCollapse(face);
}
//#endregion
//#region src/audio-player/surfaces/usePlayerSurface.ts
/**
* React layer over the pure {@link surfaceReducer}. No effects or subscriptions,
* so it is StrictMode-safe and the reducer stays the single source of truth.
*/
function usePlayerSurface(face) {
	const [state, dispatch] = useReducer((s, action) => surfaceReducer(s, action, face), INITIAL_SURFACE_STATE);
	const toggleCanvas = useCallback(() => dispatch({ type: "toggleCanvas" }), []);
	const toggleQueue = useCallback(() => dispatch({ type: "toggleQueue" }), []);
	const closeSurface = useCallback(() => dispatch({ type: "close" }), []);
	return useMemo(() => ({
		mode: state.mode,
		isCanvasOpen: state.mode === "canvas",
		isQueueOpen: state.mode === "queue",
		isHeroCollapsed: deriveHeroCollapsed(state.mode, face),
		canvasSupported: faceSupportsSEICanvas(face),
		contextualSupported: faceSupportsContextualActions(face),
		toggleCanvas,
		toggleQueue,
		closeSurface
	}), [
		state.mode,
		face,
		toggleCanvas,
		toggleQueue,
		closeSurface
	]);
}
//#endregion
//#region src/audio-player/skins/icons.tsx
var PlayIcon$1 = () => /* @__PURE__ */ jsx("svg", {
	width: "24",
	height: "24",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("path", { d: "M8 5v14l12-7z" })
});
var PauseIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	width: "24",
	height: "24",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("rect", {
		x: "6",
		y: "4",
		width: "4",
		height: "16"
	}), /* @__PURE__ */ jsx("rect", {
		x: "14",
		y: "4",
		width: "4",
		height: "16"
	})]
});
var SpinnerIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	className: "ap-spin",
	width: "24",
	height: "24",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "10",
		opacity: "0.25"
	}), /* @__PURE__ */ jsx("path", {
		d: "M12 2a10 10 0 0 1 10 10",
		strokeLinecap: "round"
	})]
});
var PrevIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("rect", {
		x: "5",
		y: "4",
		width: "2.5",
		height: "16",
		rx: "0.5"
	}), /* @__PURE__ */ jsx("path", { d: "M20 5v14L9 12z" })]
});
var NextIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("path", { d: "M4 5v14l11-7z" }), /* @__PURE__ */ jsx("rect", {
		x: "16.5",
		y: "4",
		width: "2.5",
		height: "16",
		rx: "0.5"
	})]
});
var ShuffleIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("polyline", { points: "16 3 21 3 21 8" }),
		/* @__PURE__ */ jsx("line", {
			x1: "4",
			y1: "20",
			x2: "21",
			y2: "3"
		}),
		/* @__PURE__ */ jsx("polyline", { points: "21 16 21 21 16 21" }),
		/* @__PURE__ */ jsx("line", {
			x1: "15",
			y1: "15",
			x2: "21",
			y2: "21"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "4",
			y1: "4",
			x2: "9",
			y2: "9"
		})
	]
});
var RepeatIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("polyline", { points: "17 1 21 5 17 9" }),
		/* @__PURE__ */ jsx("path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }),
		/* @__PURE__ */ jsx("polyline", { points: "7 23 3 19 7 15" }),
		/* @__PURE__ */ jsx("path", { d: "M21 13v2a4 4 0 0 1-4 4H3" })
	]
});
var RepeatOneIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("polyline", { points: "17 1 21 5 17 9" }),
		/* @__PURE__ */ jsx("path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }),
		/* @__PURE__ */ jsx("polyline", { points: "7 23 3 19 7 15" }),
		/* @__PURE__ */ jsx("path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }),
		/* @__PURE__ */ jsx("text", {
			x: "12",
			y: "15",
			textAnchor: "middle",
			fontSize: "8",
			fontWeight: "700",
			fill: "currentColor",
			stroke: "none",
			fontFamily: "system-ui, sans-serif",
			children: "1"
		})
	]
});
var AutomixIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("path", { d: "M3 7c6 0 6 10 12 10h6" }), /* @__PURE__ */ jsx("path", { d: "M3 17c6 0 6-10 12-10h6" })]
});
var ErrorIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "10"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "8",
			x2: "12",
			y2: "12"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "16",
			x2: "12.01",
			y2: "16"
		})
	]
});
var DotsIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "5",
			cy: "12",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "19",
			cy: "12",
			r: "1.8"
		})
	]
});
var QueueIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("line", {
			x1: "8",
			y1: "6",
			x2: "21",
			y2: "6"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "8",
			y1: "12",
			x2: "21",
			y2: "12"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "8",
			y1: "18",
			x2: "21",
			y2: "18"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "3",
			y1: "6",
			x2: "3.01",
			y2: "6"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "3",
			y1: "12",
			x2: "3.01",
			y2: "12"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "3",
			y1: "18",
			x2: "3.01",
			y2: "18"
		})
	]
});
var CanvasIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("rect", {
			x: "3",
			y: "4",
			width: "18",
			height: "14",
			rx: "2"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "8.5",
			cy: "9",
			r: "1.6"
		}),
		/* @__PURE__ */ jsx("path", { d: "M21 15l-5-4-7 6" })
	]
});
var WaveIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("path", { d: "M4 12v0M8 8v8M12 4v16M16 8v8M20 12v0" })
});
var ShareIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "18",
			cy: "5",
			r: "3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "6",
			cy: "12",
			r: "3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "18",
			cy: "19",
			r: "3"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "8.59",
			y1: "13.51",
			x2: "15.42",
			y2: "17.49"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "15.41",
			y1: "6.51",
			x2: "8.59",
			y2: "10.49"
		})
	]
});
var CheckIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" })
});
var LyricsIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("path", { d: "M9 18V5l12-2v13" }),
		/* @__PURE__ */ jsx("circle", {
			cx: "6",
			cy: "18",
			r: "3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "18",
			cy: "16",
			r: "3"
		})
	]
});
var AutoPlayIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("polygon", {
		points: "6 4 20 12 6 20 6 4",
		fill: "currentColor",
		stroke: "none"
	})
});
var PluginIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("path", { d: "M12 2v6" }),
		/* @__PURE__ */ jsx("path", { d: "M8 8h8v4a4 4 0 0 1-8 0z" }),
		/* @__PURE__ */ jsx("path", { d: "M9 2v4M15 2v4" }),
		/* @__PURE__ */ jsx("path", { d: "M12 16v6" })
	]
});
var ChevronLeftIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("polyline", { points: "15 18 9 12 15 6" })
});
var CloseIcon$2 = () => /* @__PURE__ */ jsxs("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("line", {
		x1: "6",
		y1: "6",
		x2: "18",
		y2: "18"
	}), /* @__PURE__ */ jsx("line", {
		x1: "18",
		y1: "6",
		x2: "6",
		y2: "18"
	})]
});
var PlaybackIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "9"
	}), /* @__PURE__ */ jsx("path", {
		d: "M10 9l5 3-5 3z",
		fill: "currentColor",
		stroke: "none"
	})]
});
var VisualIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "3"
	}), /* @__PURE__ */ jsx("path", { d: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" })]
});
var AnalyticsIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("line", {
			x1: "6",
			y1: "20",
			x2: "6",
			y2: "12"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "20",
			x2: "12",
			y2: "4"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "18",
			y1: "20",
			x2: "18",
			y2: "9"
		})
	]
});
var AgentIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("rect", {
			x: "5",
			y: "8",
			width: "14",
			height: "11",
			rx: "2.5"
		}),
		/* @__PURE__ */ jsx("path", { d: "M12 4v4" }),
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "3",
			r: "1.4",
			fill: "currentColor",
			stroke: "none"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "9.5",
			cy: "13",
			r: "1.2",
			fill: "currentColor",
			stroke: "none"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "14.5",
			cy: "13",
			r: "1.2",
			fill: "currentColor",
			stroke: "none"
		})
	]
});
var CommentsIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("path", { d: "M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.8L3 21l1.3-4a8.5 8.5 0 0 1-1-4A8.38 8.38 0 0 1 11.5 4 8.38 8.38 0 0 1 21 11.5z" })
});
var LockIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("rect", {
		x: "5",
		y: "11",
		width: "14",
		height: "9",
		rx: "2"
	}), /* @__PURE__ */ jsx("path", { d: "M8 11V8a4 4 0 0 1 8 0v3" })]
});
//#endregion
//#region src/audio-player/surfaces/SurfaceButton.tsx
/**
* The single shared surface-toggle button shell (Apple-Music style). Both the
* canvas (left) and queue (right) buttons render through this one component, so
* their size, shape, padding, press animation, and active styling are identical
* by construction. Active state is exposed via `aria-pressed` + a modifier class.
*/
function SurfaceButton({ active, children, onClick, label, disabled = false, className }) {
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		className: `ap-surface-btn ap-tap${active ? " ap-surface-btn--active" : ""}${className ? ` ${className}` : ""}`,
		onClick,
		disabled,
		"aria-pressed": active,
		"aria-label": label,
		children
	});
}
//#endregion
//#region src/audio-player/menu/menuData.ts
/**
* The V1 hardcoded menu tree. A builder (not a constant) so per-face capability
* and live surface state can adjust node states without the arc knowing about
* the player. Replaceable later by a plugin-registry-driven tree of the same shape.
*/
function buildMenuTree({ canvasSupported, isCanvasActive, includeTransport = false, canPrevious = false, canNext = false }) {
	return [
		{
			id: "plugin",
			label: "Plugin",
			icon: PluginIcon,
			children: [
				{
					id: "visual",
					label: "Visual",
					icon: VisualIcon,
					children: [
						{
							id: "lyrics",
							label: "Lyrics",
							icon: LyricsIcon,
							state: "inactive",
							actionId: "select-lyrics",
							workspaceRoute: "plugin-settings:lyrics"
						},
						{
							id: "canvas",
							label: "Canvas",
							icon: CanvasIcon,
							state: !canvasSupported ? "disabled" : isCanvasActive ? "active" : "available",
							actionId: "activate-canvas"
						},
						{
							id: "comments",
							label: "Comments",
							icon: CommentsIcon,
							state: "coming-soon"
						}
					]
				},
				{
					id: "plugin-playback",
					label: "Playback",
					icon: PlaybackIcon,
					state: "coming-soon"
				},
				{
					id: "analytics",
					label: "Analytics",
					icon: AnalyticsIcon,
					state: "coming-soon"
				}
			]
		},
		{
			id: "playback",
			label: "Playback",
			icon: PlaybackIcon,
			children: [
				...includeTransport ? [{
					id: "previous-track",
					label: "Previous",
					icon: PrevIcon$1,
					state: canPrevious ? "available" : "disabled",
					actionId: "previous-track"
				}, {
					id: "next-track",
					label: "Next",
					icon: NextIcon$1,
					state: canNext ? "available" : "disabled",
					actionId: "next-track"
				}] : [],
				{
					id: "up-next",
					label: "Up Next",
					icon: QueueIcon,
					actionId: "open-queue",
					workspaceRoute: "library:queue"
				},
				{
					id: "automix",
					label: "Automix",
					icon: AutomixIcon,
					state: "coming-soon",
					workspaceRoute: "playback:automix"
				},
				{
					id: "repeat",
					label: "Repeat",
					icon: RepeatIcon,
					state: "coming-soon"
				}
			]
		},
		{
			id: "agent",
			label: "Agent",
			icon: AgentIcon,
			state: "coming-soon",
			workspaceRoute: "agent:queue-director"
		},
		{
			id: "activity-log",
			label: "Activity Log",
			icon: AnalyticsIcon,
			state: "available",
			workspaceRoute: "diagnostics:activity-log"
		}
	];
}
/** Whether a node can be interacted with (entered or actioned). */
function isNodeInteractive(node) {
	const state = node.state ?? "available";
	return state !== "disabled" && state !== "locked" && state !== "coming-soon";
}
//#endregion
//#region src/audio-player/surfaces/SEICanvasActionMenu.tsx
/** Radius of the half-circle the nodes fan out on, in px. */
var ARC_RADIUS = 128;
/**
* The `--ap-*` tokens the trigger inherits from the player root. Copied onto the
* portal container so the menu stays themed even though it renders on
* `document.body`, outside the player's token scope. Keeping this a plain list
* (rather than importing the theme builder) lets the arc stay decoupled.
*/
var THEME_VARS = [
	"--ap-accent",
	"--ap-text",
	"--ap-play-icon",
	"--ap-bg",
	"--ap-vault-accent"
];
/**
* Polar fan geometry: `n` points spread across a half-circle that opens upward
* (angles 180°→0°), centered on the pivot. `y` is negative (up). A single item
* sits straight above the pivot.
*/
function arcOffsets(n, radius = 128) {
	if (n <= 0) return [];
	if (n === 1) return [{
		x: 0,
		y: -radius
	}];
	return Array.from({ length: n }, (_, i) => {
		const rad = (180 - i / (n - 1) * 180) * Math.PI / 180;
		return {
			x: radius * Math.cos(rad),
			y: -radius * Math.sin(rad)
		};
	});
}
/** Walk `items` by the id `path` to the current submenu level + breadcrumb. */
function resolveLevel(items, path) {
	let level = items;
	const trail = [];
	for (const id of path) {
		const node = level.find((n) => n.id === id);
		if (!node || !node.children) break;
		trail.push(node.label);
		level = node.children;
	}
	return {
		level,
		trail
	};
}
/** Default trigger glyph — a small command-wheel mark. */
var TriggerIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "2.2"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "4.5",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "18.5",
			cy: "15.5",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "5.5",
			cy: "15.5",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("path", { d: "M12 6.7v3M13.8 13.1l2.8 1.6M10.2 13.1l-2.8 1.6" })
	]
});
/**
* The SEI Canvas Action Menu: a bottom-anchored half-circle command wheel. The
* closed state is a single round trigger that drops into the queue surface slot.
* Tapping it opens a dimmed, blurred portal overlay that fans the menu items on
* an arc, with submenu navigation, a depth-aware Close/Back center button, and a
* breadcrumb. The arc's open + navigation state is entirely local here — it is an
* overlay, never a player surface. Kept free of engine/session imports so it can
* later be promoted into the seihouse-ui design system.
*/
function SEICanvasActionMenu({ items, onOpenQueue, onActivateCanvas, onSelect, onOpenWorkspace, ariaLabel = "Canvas actions", className }) {
	const triggerRef = useRef(null);
	const centerRef = useRef(null);
	const [open, setOpen] = useState(false);
	const [entered, setEntered] = useState(false);
	const [path, setPath] = useState([]);
	const [themeStyle, setThemeStyle] = useState({});
	const [arcRadius, setArcRadius] = useState(128);
	const close = useCallback(() => {
		setOpen(false);
		setEntered(false);
		setPath([]);
	}, []);
	const openMenu = useCallback(() => {
		const el = triggerRef.current;
		if (el) {
			const cs = getComputedStyle(el);
			const vars = {};
			for (const name of THEME_VARS) {
				const value = cs.getPropertyValue(name).trim();
				if (value) vars[name] = value;
			}
			setThemeStyle(vars);
		}
		setOpen(true);
	}, []);
	useEffect(() => {
		if (!open) return;
		const raf = requestAnimationFrame(() => setEntered(true));
		return () => cancelAnimationFrame(raf);
	}, [open]);
	useEffect(() => {
		if (!open || typeof window === "undefined") return;
		const updateRadius = () => {
			const vw = window.innerWidth;
			if (vw < 400) setArcRadius(96);
			else if (vw < 600) setArcRadius(112);
			else setArcRadius(128);
		};
		updateRadius();
		window.addEventListener("resize", updateRadius);
		return () => window.removeEventListener("resize", updateRadius);
	}, [open]);
	useEffect(() => {
		if (!open) return;
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const raf = requestAnimationFrame(() => centerRef.current?.focus());
		const handleKey = (e) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("keydown", handleKey);
		return () => {
			document.body.style.overflow = prevOverflow;
			cancelAnimationFrame(raf);
			document.removeEventListener("keydown", handleKey);
			const trigger = triggerRef.current;
			if (trigger?.isConnected) trigger.focus();
		};
	}, [open, close]);
	const { level, trail } = resolveLevel(items, path);
	const offsets = arcOffsets(level.length, arcRadius);
	const handleNode = useCallback((node) => {
		if (!isNodeInteractive(node)) return;
		if (node.children && node.children.length > 0) {
			setPath((p) => [...p, node.id]);
			return;
		}
		if (node.workspaceRoute && onOpenWorkspace) {
			onOpenWorkspace(node.workspaceRoute);
			close();
			return;
		}
		switch (node.actionId) {
			case "open-queue":
				onOpenQueue?.();
				break;
			case "activate-canvas":
				onActivateCanvas?.();
				break;
			default: onSelect?.(node);
		}
		close();
	}, [
		close,
		onActivateCanvas,
		onOpenQueue,
		onOpenWorkspace,
		onSelect
	]);
	const handleCenter = useCallback(() => {
		if (path.length > 0) setPath((p) => p.slice(0, -1));
		else close();
	}, [close, path.length]);
	const inSubmenu = path.length > 0;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
		ref: triggerRef,
		type: "button",
		className: `ap-surface-btn ap-tap${open ? " ap-surface-btn--active" : ""}${className ? ` ${className}` : ""}`,
		onClick: openMenu,
		"aria-haspopup": "menu",
		"aria-expanded": open,
		"aria-label": ariaLabel,
		children: /* @__PURE__ */ jsx(TriggerIcon, {})
	}), open && typeof document !== "undefined" && createPortal(/* @__PURE__ */ jsxs("div", {
		className: "sac",
		style: themeStyle,
		children: [/* @__PURE__ */ jsx("div", {
			className: "sac__backdrop",
			onPointerDown: (e) => {
				if (e.button === 0) close();
			},
			"aria-hidden": "true",
			"data-entered": entered
		}), /* @__PURE__ */ jsx("div", {
			className: "sac__stage",
			role: "menu",
			"aria-label": ariaLabel,
			children: /* @__PURE__ */ jsxs("div", {
				className: "sac__arc",
				"data-open": entered,
				style: { "--arc-radius": `${arcRadius}px` },
				children: [
					inSubmenu && /* @__PURE__ */ jsx("div", {
						className: "sac__crumb",
						"aria-hidden": "true",
						children: trail.join(" › ")
					}),
					level.map((node, i) => {
						const state = node.state ?? "available";
						const interactive = isNodeInteractive(node);
						const offset = offsets[i];
						const Icon = node.icon;
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							role: "menuitem",
							className: `sac__node sac__node--${state}`,
							style: {
								"--sac-x": `${offset.x}px`,
								"--sac-y": `${offset.y}px`,
								transitionDelay: `${i * 8}ms`
							},
							onClick: () => handleNode(node),
							"aria-disabled": !interactive,
							"aria-haspopup": node.children ? "menu" : void 0,
							tabIndex: interactive ? 0 : -1,
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "sac__node-icon",
									children: state === "locked" ? /* @__PURE__ */ jsx(LockIcon, {}) : /* @__PURE__ */ jsx(Icon, {})
								}),
								/* @__PURE__ */ jsx("span", {
									className: "sac__node-label",
									children: node.label
								}),
								state === "coming-soon" && /* @__PURE__ */ jsx("span", {
									className: "sac__badge",
									children: "soon"
								})
							]
						}, node.id);
					}),
					/* @__PURE__ */ jsx("button", {
						ref: centerRef,
						type: "button",
						className: "sac__center ap-tap",
						onClick: handleCenter,
						"aria-label": inSubmenu ? "Back" : "Close menu",
						children: inSubmenu ? /* @__PURE__ */ jsx(ChevronLeftIcon, {}) : /* @__PURE__ */ jsx(CloseIcon$2, {})
					})
				]
			})
		})]
	}), document.body)] });
}
//#endregion
//#region src/audio-player/surfaces/PlayerSurfaceButtons.tsx
/**
* The shared left/right surface controls. LEFT reveals the SEICanvas (only on
* faces that support it). RIGHT is the SEI Canvas Action Menu — a bottom-arc
* command wheel that replaces the old flat "Up Next" toggle. Queue lives inside
* it under Playback › Up Next; the canvas under Plugin › Visual › Canvas.
*/
function PlayerSurfaceButtons({ surface, showCanvasButton = surface.canvasSupported, showQueueButton = surface.contextualSupported, onOpenQueue, showTransport = false, canPrevious = false, canNext = false, onPrevious, onNext, onOpenFocusedController, className }) {
	const menuItems = useMemo(() => showQueueButton ? buildMenuTree({
		canvasSupported: surface.canvasSupported,
		isCanvasActive: surface.isCanvasOpen,
		includeTransport: showTransport,
		canPrevious,
		canNext
	}) : [], [
		showQueueButton,
		surface.canvasSupported,
		surface.isCanvasOpen,
		showTransport,
		canPrevious,
		canNext
	]);
	const handleSelect = useCallback((node) => {
		if (node.actionId === "previous-track") onPrevious?.();
		else if (node.actionId === "next-track") onNext?.();
	}, [onNext, onPrevious]);
	const handleOpenWorkspace = useCallback((route) => {
		onOpenFocusedController?.(route);
	}, [onOpenFocusedController]);
	if (!showCanvasButton && !showQueueButton) return null;
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-surface-actions${className ? ` ${className}` : ""}`,
		role: "group",
		"aria-label": "Player surfaces",
		children: [showCanvasButton && /* @__PURE__ */ jsx(SurfaceButton, {
			active: surface.isCanvasOpen,
			onClick: surface.toggleCanvas,
			label: "SEI Canvas",
			children: /* @__PURE__ */ jsx(CanvasIcon, {})
		}), showQueueButton && /* @__PURE__ */ jsx(SEICanvasActionMenu, {
			items: menuItems,
			onActivateCanvas: surface.toggleCanvas,
			onOpenQueue: onOpenQueue ?? surface.toggleQueue,
			onOpenWorkspace: handleOpenWorkspace,
			onSelect: handleSelect
		})]
	});
}
//#endregion
//#region src/audio-player/surfaces/SEICanvasHost.tsx
/**
* The main visual surface region (SEICanvas). Phase 1 renders placeholder/demo
* content only — no waveform, artwork, lyrics, or visualizers.
*
* - Returns `null` when the face doesn't support a canvas, so compact/mini faces
*   never render this zone (capability-driven, not a layout check).
* - When supported, it always renders a stable container (even while closed) so
*   a future plugin can mount into `[data-sei-canvas-host]` reliably. Open/close
*   is animated via the `data-open` attribute in CSS.
*/
function SEICanvasHost({ open, face, supported, activeSurfaceId, children }) {
	if (!supported) return null;
	return /* @__PURE__ */ jsx("div", {
		className: "ap-sei-canvas-host",
		"data-sei-canvas-host": "",
		"data-open": open ? "true" : "false",
		"data-face": face,
		"data-surface-id": activeSurfaceId,
		"aria-hidden": open ? void 0 : true,
		children: /* @__PURE__ */ jsx("div", {
			className: "ap-sei-canvas-host__inner",
			children
		})
	});
}
//#endregion
//#region src/audio-player/surfaces/QueueSurface.tsx
/**
* In-region "Up Next" surface (Apple-Music style), rendered inside the shared
* surface region by the right surface button. Reads the shared session queue;
* tap a row to jump to that track. This is intentionally lightweight — the full
* drag-to-reorder/remove experience stays in the existing QueueDrawer overlay.
*/
function QueueSurface({ maxItems, className }) {
	const s = useAudioSession();
	const { queue, currentIndex } = s;
	const upcoming = queue.map((track, index) => ({
		track,
		index
	})).filter(({ index }) => index >= currentIndex);
	const items = typeof maxItems === "number" ? upcoming.slice(0, maxItems) : upcoming;
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-queue-surface${className ? ` ${className}` : ""}`,
		role: "group",
		"aria-label": "Up next",
		children: [/* @__PURE__ */ jsx("div", {
			className: "ap-queue-surface__head",
			children: "Up next"
		}), items.length === 0 ? /* @__PURE__ */ jsx("div", {
			className: "ap-queue-surface__empty",
			children: "Queue is empty"
		}) : /* @__PURE__ */ jsx("ul", {
			className: "ap-queue-surface__list",
			children: items.map(({ track, index }) => {
				const isCurrent = index === currentIndex;
				return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `ap-queue-surface__row ap-tap${isCurrent ? " ap-queue-surface__row--current" : ""}`,
					onClick: () => s.playTrack(index),
					"aria-current": isCurrent ? "true" : void 0,
					children: [/* @__PURE__ */ jsx("span", {
						className: "ap-queue-surface__title",
						title: track.title,
						children: track.title
					}), /* @__PURE__ */ jsx("span", {
						className: "ap-queue-surface__artist",
						title: track.artist,
						children: track.artist
					})]
				}) }, track.id ?? `${track.title}-${index}`);
			})
		})]
	});
}
//#endregion
//#region src/audio-player/visual-slots/components/LyricDisplay.tsx
var LYRIC_DISPLAY_ID = "lyric-display";
var lyricDefaultSettings = {
	fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	fontWeight: 600,
	fontSize: 18,
	lineHeight: 1.6,
	highlightColor: "#7cc4ff",
	animationMode: "fade"
};
var FONT_FAMILY_OPTIONS = [
	{
		label: "System Sans",
		value: lyricDefaultSettings.fontFamily
	},
	{
		label: "Serif",
		value: "Georgia, 'Times New Roman', serif"
	},
	{
		label: "Mono",
		value: "'SF Mono', 'Roboto Mono', Menlo, monospace"
	},
	{
		label: "Rounded",
		value: "'Nunito', 'Segoe UI', system-ui, sans-serif"
	}
];
var ANIMATION_OPTIONS = [
	{
		label: "None",
		value: "none"
	},
	{
		label: "Fade",
		value: "fade"
	},
	{
		label: "Slide",
		value: "slide"
	}
];
/** Split a raw lyrics blob into non-empty display lines. */
function toLines(lyrics) {
	if (!lyrics) return [];
	return lyrics.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}
/**
* The mounted SEI Canvas visual. Playback context (lyrics, position, duration)
* arrives via props from the host renderer rather than the global audio session,
* so the component works in every player — including the portable one that has no
* `AudioSessionProvider`. With no timed-lyric metadata available, the "active"
* line is estimated from playback progress so the highlight still moves with the
* track — a real, settings-driven visual rather than a placeholder.
*/
function LyricDisplay({ settings, playback }) {
	const currentTime = playback?.currentTime ?? 0;
	const duration = playback?.duration ?? 0;
	const lines = useMemo(() => toLines(playback?.lyrics), [playback?.lyrics]);
	const containerRef = useRef(null);
	const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
	const activeIndex = lines.length > 0 ? Math.min(lines.length - 1, Math.floor(ratio * lines.length)) : -1;
	useEffect(() => {
		(containerRef.current?.querySelector("[data-active=\"true\"]"))?.scrollIntoView({
			behavior: settings.animationMode === "none" ? "auto" : "smooth",
			block: "center",
			inline: "nearest"
		});
	}, [activeIndex, settings.animationMode]);
	if (lines.length === 0) return /* @__PURE__ */ jsxs("div", {
		className: "sap-visual-lyric sap-visual-lyric--empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-visual-lyric__empty-title",
			children: "No lyrics"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-visual-lyric__empty-hint",
			children: "This track has no lyrics to display."
		})]
	});
	return /* @__PURE__ */ jsx("div", {
		className: "sap-visual-lyric",
		ref: containerRef,
		"data-animation": settings.animationMode,
		style: {
			fontFamily: settings.fontFamily,
			fontWeight: settings.fontWeight,
			fontSize: `${settings.fontSize}px`,
			lineHeight: settings.lineHeight
		},
		children: lines.map((line, i) => {
			const isActive = i === activeIndex;
			return /* @__PURE__ */ jsx("p", {
				className: "sap-visual-lyric__line",
				"data-active": isActive ? "true" : "false",
				style: isActive ? { color: settings.highlightColor } : void 0,
				children: line
			}, `${i}-${line}`);
		})
	});
}
/** A labeled field row used by the settings panel. */
function Field({ label, children }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "sap-visual-field",
		children: [/* @__PURE__ */ jsx("span", {
			className: "sap-visual-field__label",
			children: label
		}), children]
	});
}
/**
* Controlled settings editor for the lyric display. Rendered through the lyrics
* workspace route via {@link ControllerPanelRenderer}; edits flow back through
* `onChange` and update the live SEI Canvas visual.
*/
function LyricSettingsPanel({ settings, onChange }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-visual-settings",
		children: [
			/* @__PURE__ */ jsx(Field, {
				label: "Font family",
				children: /* @__PURE__ */ jsx("select", {
					className: "sap-visual-input",
					value: settings.fontFamily,
					onChange: (e) => onChange({ fontFamily: e.target.value }),
					children: FONT_FAMILY_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
						value: opt.value,
						children: opt.label
					}, opt.label))
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: `Font weight (${settings.fontWeight})`,
				children: /* @__PURE__ */ jsx("input", {
					className: "sap-visual-input",
					type: "range",
					min: 100,
					max: 900,
					step: 100,
					value: settings.fontWeight,
					onChange: (e) => onChange({ fontWeight: Number(e.target.value) })
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: `Font size (${settings.fontSize}px)`,
				children: /* @__PURE__ */ jsx("input", {
					className: "sap-visual-input",
					type: "range",
					min: 12,
					max: 48,
					step: 1,
					value: settings.fontSize,
					onChange: (e) => onChange({ fontSize: Number(e.target.value) })
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: `Line height (${settings.lineHeight.toFixed(1)})`,
				children: /* @__PURE__ */ jsx("input", {
					className: "sap-visual-input",
					type: "range",
					min: 1,
					max: 3,
					step: .1,
					value: settings.lineHeight,
					onChange: (e) => onChange({ lineHeight: Number(e.target.value) })
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: "Highlight color",
				children: /* @__PURE__ */ jsx("input", {
					className: "sap-visual-input sap-visual-input--color",
					type: "color",
					value: settings.highlightColor,
					onChange: (e) => onChange({ highlightColor: e.target.value })
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: "Animation mode",
				children: /* @__PURE__ */ jsx("select", {
					className: "sap-visual-input",
					value: settings.animationMode,
					onChange: (e) => onChange({ animationMode: e.target.value }),
					children: ANIMATION_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
						value: opt.value,
						children: opt.label
					}, opt.value))
				})
			})
		]
	});
}
/** The registrable definition wiring the display + panel into the seiCanvas slot. */
var lyricDisplayDefinition = {
	id: LYRIC_DISPLAY_ID,
	name: "Lyric Display",
	slot: "seiCanvas",
	Component: LyricDisplay,
	SettingsPanel: LyricSettingsPanel,
	defaultSettings: lyricDefaultSettings
};
//#endregion
//#region src/audio-player/visual-slots/components/imported/sample-skin/raw.tsx
/**
* Sample visual component for testing the skin import CLI.
* This is a minimal Sea-Workshop-Light format #2 (structured React) export.
*/
function SampleVisual({ primaryColor = "#7cc4ff", label = "Hello Skin" }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "container",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "title",
			style: { color: primaryColor },
			children: label
		}), /* @__PURE__ */ jsx("div", { className: "ring" })]
	});
}
//#endregion
//#region src/audio-player/visual-slots/components/imported/sample-skin/SampleSkin.tsx
/** Default settings for this skin. Edit to match your component's API. */
var sampleSkinDefaultSettings = {};
function SampleSkin({ settings, playback }) {
	return /* @__PURE__ */ jsx("div", {
		className: "sap-visual-sample-skin",
		children: /* @__PURE__ */ jsx(SampleVisual, {})
	});
}
function SampleSkinSettingsPanel({ settings, onChange }) {
	return /* @__PURE__ */ jsx("div", {
		className: "sap-visual-settings",
		children: /* @__PURE__ */ jsxs("p", {
			style: {
				opacity: .6,
				fontSize: 12
			},
			children: [
				"No settings configured yet. Edit this panel in ",
				SampleSkin.name,
				".tsx."
			]
		})
	});
}
//#endregion
//#region src/audio-player/visual-slots/builtins.ts
/**
* The built-in visual components SAP ships with. Registered by
* {@link VisualSlotsProvider} on first mount. Order matters: the first entry for
* a slot becomes that slot's default (see `getDefaultComponentForSlot`), so the
* lyric display is the default `seiCanvas` visual and canvas mode shows it
* immediately instead of a placeholder.
*
* To add the next Workshop-Light component: build it under `components/`, scope
* its CSS, declare a definition, and append it here (or register it from a host
* app via `registerVisualComponent`). No player-core edits required.
*
* Imported skins (from `npm run skin:import`) are spread after the built-ins so
* LyricDisplay keeps its default position.
*/
var BUILTIN_VISUAL_COMPONENTS = [lyricDisplayDefinition, ...[{
	id: "sample-skin",
	name: "Sample Skin",
	slot: "seiCanvas",
	Component: SampleSkin,
	SettingsPanel: SampleSkinSettingsPanel,
	defaultSettings: sampleSkinDefaultSettings
}]];
//#endregion
//#region src/audio-player/visual-slots/visualRegistry.ts
/**
* The visual component registry. A plain module-level map keyed by component id.
* Registration is idempotent (re-registering the same id replaces it), so a host
* app can override a built-in by registering its own definition under that id.
*
* This is deliberately tiny: it is an *intake* layer, not a plugin framework. It
* holds no state about which component is active or what its settings are — that
* lives per-player in {@link VisualSlotsProvider}.
*/
var REGISTRY = /* @__PURE__ */ new Map();
/** Register (or replace) a visual component definition. */
function registerVisualComponent(definition) {
	REGISTRY.set(definition.id, definition);
}
/** Look up a component by id, or `undefined` if not registered. */
function getVisualComponent(id) {
	if (!id) return void 0;
	return REGISTRY.get(id);
}
/** All registered components targeting a given slot, in registration order. */
function getVisualComponentsForSlot(slot) {
	const out = [];
	for (const def of REGISTRY.values()) if (def.slot === slot) out.push(def);
	return out;
}
/**
* The default component for a slot: the first one registered into it. The lyric
* display is registered first for `seiCanvas`, so canvas mode shows it on open.
*/
function getDefaultComponentForSlot(slot) {
	for (const def of REGISTRY.values()) if (def.slot === slot) return def;
}
/** All registered components (any slot). Used to seed the settings store. */
function getAllVisualComponents() {
	return Array.from(REGISTRY.values());
}
//#endregion
//#region src/audio-player/visual-slots/VisualSlotsContext.tsx
for (const def of BUILTIN_VISUAL_COMPONENTS) registerVisualComponent(def);
var EMPTY_OBJECT = {};
/** Seed `activeBySlot` from the registry default for each slot. */
function seedActive() {
	const slots = [
		"seiCanvas",
		"scrubberCanvas",
		"controllerPanel"
	];
	const out = {};
	for (const slot of slots) out[slot] = getDefaultComponentForSlot(slot)?.id ?? null;
	return out;
}
/** Seed `settingsById` from every registered component's defaultSettings. */
function seedSettings() {
	const out = {};
	for (const def of getAllVisualComponents()) out[def.id] = { ...def.defaultSettings };
	return out;
}
var VisualSlotsContext = createContext(null);
/**
* Holds the active component per slot and the live settings per component for a
* single player instance. Mounted inside each skin so the state reaches both the
* SEI Canvas (player stage) and the settings panel (rendered through the
* SAPController portal) — React context flows through portals.
*/
function VisualSlotsProvider({ children }) {
	const [activeBySlot, setActiveBySlot] = useState(seedActive);
	const [settingsById, setSettingsById] = useState(seedSettings);
	const getActive = useCallback((slot) => activeBySlot[slot] ?? null, [activeBySlot]);
	const setActive = useCallback((slot, id) => {
		setActiveBySlot((prev) => ({
			...prev,
			[slot]: id
		}));
	}, []);
	const getSettings = useCallback((id) => settingsById[id] ?? getDefaultsFor(id) ?? EMPTY_OBJECT, [settingsById]);
	const updateSettings = useCallback((id, partial) => {
		setSettingsById((prev) => {
			const base = prev[id] ?? getDefaultsFor(id) ?? {};
			return {
				...prev,
				[id]: {
					...base,
					...partial
				}
			};
		});
	}, []);
	const value = useMemo(() => ({
		getActive,
		setActive,
		getSettings,
		updateSettings
	}), [
		getActive,
		setActive,
		getSettings,
		updateSettings
	]);
	return /* @__PURE__ */ jsx(VisualSlotsContext.Provider, {
		value,
		children
	});
}
var defaultsCache = /* @__PURE__ */ new Map();
/** Defaults lookup that tolerates components registered after seeding. */
function getDefaultsFor(id) {
	const cached = defaultsCache.get(id);
	if (cached) return cached;
	for (const def of getAllVisualComponents()) if (def.id === id) {
		const defaults = { ...def.defaultSettings };
		defaultsCache.set(id, defaults);
		return defaults;
	}
}
/**
* A read-only fallback used when no {@link VisualSlotsProvider} is mounted, so
* the renderers still show registry defaults (and settings edits become no-ops)
* rather than crashing. The skins always provide a real context.
*/
var FALLBACK = {
	getActive: (slot) => getDefaultComponentForSlot(slot)?.id ?? null,
	setActive: () => {},
	getSettings: (id) => getDefaultsFor(id) ?? EMPTY_OBJECT,
	updateSettings: () => {}
};
/** Access the per-player visual-slot store (or the read-only fallback). */
function useVisualSlots() {
	return useContext(VisualSlotsContext) ?? FALLBACK;
}
//#endregion
//#region src/audio-player/visual-slots/SEICanvasRenderer.tsx
/**
* Mounts the active `seiCanvas` visual component into the SEI Canvas region with
* its live settings. Replaces the old placeholder/demo content. When no seiCanvas
* component is active it renders a clean empty state — not "plugins mount here".
*
* Playback context is passed in via props (sourced from the session in
* session-based skins, or the portable player's own engine) and forwarded to the
* component, so visual components stay decoupled from the global audio session.
*/
function SEICanvasRenderer({ currentTime = 0, duration = 0, lyrics } = {}) {
	const slots = useVisualSlots();
	const def = getVisualComponent(slots.getActive("seiCanvas"));
	if (!def) return /* @__PURE__ */ jsxs("div", {
		className: "sap-visual-empty",
		children: [/* @__PURE__ */ jsx("span", {
			className: "sap-visual-empty__title",
			children: "SEI Canvas"
		}), /* @__PURE__ */ jsx("span", {
			className: "sap-visual-empty__hint",
			children: "No visual selected."
		})]
	});
	const { Component } = def;
	return /* @__PURE__ */ jsx(Component, {
		settings: slots.getSettings(def.id),
		playback: {
			currentTime,
			duration,
			lyrics
		}
	});
}
//#endregion
//#region src/audio-player/visual-slots/ScrubberCanvasRenderer.tsx
/**
* Intake point for `scrubberCanvas` visuals. If a component is active for the
* slot it is mounted with live timeline props + its settings; otherwise the
* provided `children` (the existing waveform/progress) render unchanged. No
* scrubberCanvas component ships in V1, so the default path is the fallback.
*/
function ScrubberCanvasRenderer({ currentTime, duration, onSeek, children }) {
	const slots = useVisualSlots();
	const def = getVisualComponent(slots.getActive("scrubberCanvas"));
	if (!def) return /* @__PURE__ */ jsx(Fragment, { children });
	const { Component } = def;
	return /* @__PURE__ */ jsx(Component, { settings: {
		...slots.getSettings(def.id),
		currentTime,
		duration,
		onSeek
	} });
}
//#endregion
//#region src/audio-player/components/VolumeControl.tsx
/**
* Mute toggle + a custom vertical-agnostic horizontal slider, built on the same
* Pointer Events pattern as the scrubber for consistent behavior. Note: iOS
* Safari ignores programmatic volume, so the mute button is the reliable control
* there; the slider is effectively desktop-only. We surface a small hint to
* users when we detect that the browser is not honoring the slider.
*/
function VolumeControl({ volume, isMuted, disabled, volumeUnsupported = false, onVolumeChange, onToggleMute }) {
	const trackRef = useRef(null);
	const captureIdRef = useRef(null);
	const captureTargetRef = useRef(null);
	const ratioFromEvent = useCallback((clientX) => {
		const el = trackRef.current;
		if (!el) return 0;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0) return 0;
		return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
	}, []);
	const releaseCapture = useCallback(() => {
		const target = captureTargetRef.current;
		const id = captureIdRef.current;
		if (target !== null && id !== null) try {
			if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
		} catch {}
		captureTargetRef.current = null;
		captureIdRef.current = null;
	}, []);
	const handlePointerDown = useCallback((event) => {
		if (disabled || event.button !== 0) return;
		const target = event.currentTarget;
		try {
			target.setPointerCapture(event.pointerId);
		} catch {}
		captureTargetRef.current = target;
		captureIdRef.current = event.pointerId;
		onVolumeChange(ratioFromEvent(event.clientX));
	}, [
		disabled,
		onVolumeChange,
		ratioFromEvent
	]);
	const handlePointerMove = useCallback((event) => {
		if (disabled) return;
		if (captureIdRef.current === null || event.pointerId !== captureIdRef.current) return;
		onVolumeChange(ratioFromEvent(event.clientX));
	}, [
		disabled,
		onVolumeChange,
		ratioFromEvent
	]);
	const handlePointerUp = useCallback((event) => {
		const id = captureIdRef.current;
		if (id === null || event.pointerId !== id) return;
		releaseCapture();
	}, [releaseCapture]);
	const handleKeyDown = useCallback((event) => {
		if (disabled) return;
		let next = null;
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				next = volume + .05;
				break;
			case "ArrowLeft":
			case "ArrowDown":
				next = volume - .05;
				break;
			case "PageUp":
				next = volume + .1;
				break;
			case "PageDown":
				next = volume - .1;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = 1;
				break;
			default: return;
		}
		event.preventDefault();
		onVolumeChange(Math.max(0, Math.min(1, next)));
	}, [
		disabled,
		onVolumeChange,
		volume
	]);
	useEffect(() => {
		return () => {
			releaseCapture();
		};
	}, [releaseCapture]);
	const effective = isMuted ? 0 : volume;
	const rawPct = effective * 100;
	const pct = Number.isFinite(rawPct) ? Math.max(0, Math.min(100, rawPct)) : 0;
	return /* @__PURE__ */ jsxs("div", {
		className: "ap-volume",
		children: [
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "ap-icon-btn ap-volume__mute",
				onClick: onToggleMute,
				disabled,
				"aria-label": isMuted ? "Unmute" : "Mute",
				"aria-pressed": isMuted,
				children: isMuted || effective === 0 ? /* @__PURE__ */ jsx("svg", {
					width: "18",
					height: "18",
					viewBox: "0 0 24 24",
					fill: "currentColor",
					"aria-hidden": "true",
					children: /* @__PURE__ */ jsx("path", { d: "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" })
				}) : /* @__PURE__ */ jsx("svg", {
					width: "18",
					height: "18",
					viewBox: "0 0 24 24",
					fill: "currentColor",
					"aria-hidden": "true",
					children: /* @__PURE__ */ jsx("path", { d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" })
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				ref: trackRef,
				className: "ap-volume__slider",
				role: "slider",
				tabIndex: disabled ? -1 : 0,
				"aria-label": "Volume",
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				"aria-valuenow": Math.round(pct),
				"aria-valuetext": `${Math.round(pct)}% volume`,
				"aria-disabled": disabled,
				onPointerDown: handlePointerDown,
				onPointerMove: handlePointerMove,
				onPointerUp: handlePointerUp,
				onPointerCancel: handlePointerUp,
				onKeyDown: handleKeyDown,
				children: [
					/* @__PURE__ */ jsx("div", { className: "ap-volume__track" }),
					/* @__PURE__ */ jsx("div", {
						className: "ap-volume__fill",
						style: { width: `${pct}%` }
					}),
					/* @__PURE__ */ jsx("div", {
						className: "ap-volume__thumb",
						style: { left: `${pct}%` }
					})
				]
			}),
			volumeUnsupported && !disabled && /* @__PURE__ */ jsx("span", {
				className: "ap-volume__hint",
				role: "note",
				"aria-label": "Use the mute button to silence audio; this browser does not support volume control",
				children: "iOS"
			})
		]
	});
}
//#endregion
//#region node_modules/@babel/runtime/helpers/esm/extends.js
function _extends() {
	return _extends = Object.assign ? Object.assign.bind() : function(n) {
		for (var e = 1; e < arguments.length; e++) {
			var t = arguments[e];
			for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
		}
		return n;
	}, _extends.apply(null, arguments);
}
//#endregion
//#region node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
function _assertThisInitialized(e) {
	if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
//#endregion
//#region node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
function _setPrototypeOf(t, e) {
	return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t, e) {
		return t.__proto__ = e, t;
	}, _setPrototypeOf(t, e);
}
//#endregion
//#region node_modules/@babel/runtime/helpers/esm/inheritsLoose.js
function _inheritsLoose(t, o) {
	t.prototype = Object.create(o.prototype), t.prototype.constructor = t, _setPrototypeOf(t, o);
}
//#endregion
//#region node_modules/memoize-one/dist/memoize-one.esm.js
var safeIsNaN = Number.isNaN || function ponyfill(value) {
	return typeof value === "number" && value !== value;
};
function isEqual(first, second) {
	if (first === second) return true;
	if (safeIsNaN(first) && safeIsNaN(second)) return true;
	return false;
}
function areInputsEqual(newInputs, lastInputs) {
	if (newInputs.length !== lastInputs.length) return false;
	for (var i = 0; i < newInputs.length; i++) if (!isEqual(newInputs[i], lastInputs[i])) return false;
	return true;
}
function memoizeOne(resultFn, isEqual) {
	if (isEqual === void 0) isEqual = areInputsEqual;
	var lastThis;
	var lastArgs = [];
	var lastResult;
	var calledOnce = false;
	function memoized() {
		var newArgs = [];
		for (var _i = 0; _i < arguments.length; _i++) newArgs[_i] = arguments[_i];
		if (calledOnce && lastThis === this && isEqual(newArgs, lastArgs)) return lastResult;
		lastResult = resultFn.apply(this, newArgs);
		calledOnce = true;
		lastThis = this;
		lastArgs = newArgs;
		return lastResult;
	}
	return memoized;
}
//#endregion
//#region node_modules/react-window/dist/index.esm.js
var now = typeof performance === "object" && typeof performance.now === "function" ? function() {
	return performance.now();
} : function() {
	return Date.now();
};
function cancelTimeout(timeoutID) {
	cancelAnimationFrame(timeoutID.id);
}
function requestTimeout(callback, delay) {
	var start = now();
	function tick() {
		if (now() - start >= delay) callback.call(null);
		else timeoutID.id = requestAnimationFrame(tick);
	}
	var timeoutID = { id: requestAnimationFrame(tick) };
	return timeoutID;
}
var size = -1;
function getScrollbarSize(recalculate) {
	if (recalculate === void 0) recalculate = false;
	if (size === -1 || recalculate) {
		var div = document.createElement("div");
		var style = div.style;
		style.width = "50px";
		style.height = "50px";
		style.overflow = "scroll";
		document.body.appendChild(div);
		size = div.offsetWidth - div.clientWidth;
		document.body.removeChild(div);
	}
	return size;
}
var cachedRTLResult = null;
function getRTLOffsetType(recalculate) {
	if (recalculate === void 0) recalculate = false;
	if (cachedRTLResult === null || recalculate) {
		var outerDiv = document.createElement("div");
		var outerStyle = outerDiv.style;
		outerStyle.width = "50px";
		outerStyle.height = "50px";
		outerStyle.overflow = "scroll";
		outerStyle.direction = "rtl";
		var innerDiv = document.createElement("div");
		var innerStyle = innerDiv.style;
		innerStyle.width = "100px";
		innerStyle.height = "100px";
		outerDiv.appendChild(innerDiv);
		document.body.appendChild(outerDiv);
		if (outerDiv.scrollLeft > 0) cachedRTLResult = "positive-descending";
		else {
			outerDiv.scrollLeft = 1;
			if (outerDiv.scrollLeft === 0) cachedRTLResult = "negative";
			else cachedRTLResult = "positive-ascending";
		}
		document.body.removeChild(outerDiv);
		return cachedRTLResult;
	}
	return cachedRTLResult;
}
if (process.env.NODE_ENV !== "production") {
	if (typeof window !== "undefined" && typeof window.WeakSet !== "undefined") {}
}
var IS_SCROLLING_DEBOUNCE_INTERVAL$1 = 150;
var defaultItemKey$1 = function defaultItemKey(index, data) {
	return index;
};
var devWarningsDirection = null;
var devWarningsTagName$1 = null;
if (process.env.NODE_ENV !== "production") {
	if (typeof window !== "undefined" && typeof window.WeakSet !== "undefined") {
		devWarningsDirection = /*#__PURE__*/ new WeakSet();
		devWarningsTagName$1 = /*#__PURE__*/ new WeakSet();
	}
}
function createListComponent(_ref) {
	var _class;
	var getItemOffset = _ref.getItemOffset, getEstimatedTotalSize = _ref.getEstimatedTotalSize, getItemSize = _ref.getItemSize, getOffsetForIndexAndAlignment = _ref.getOffsetForIndexAndAlignment, getStartIndexForOffset = _ref.getStartIndexForOffset, getStopIndexForStartIndex = _ref.getStopIndexForStartIndex, initInstanceProps = _ref.initInstanceProps, shouldResetStyleCacheOnItemSizeChange = _ref.shouldResetStyleCacheOnItemSizeChange, validateProps = _ref.validateProps;
	return _class = /*#__PURE__*/ function(_PureComponent) {
		_inheritsLoose(List, _PureComponent);
		function List(props) {
			var _this = _PureComponent.call(this, props) || this;
			_this._instanceProps = initInstanceProps(_this.props, _assertThisInitialized(_this));
			_this._outerRef = void 0;
			_this._resetIsScrollingTimeoutId = null;
			_this.state = {
				instance: _assertThisInitialized(_this),
				isScrolling: false,
				scrollDirection: "forward",
				scrollOffset: typeof _this.props.initialScrollOffset === "number" ? _this.props.initialScrollOffset : 0,
				scrollUpdateWasRequested: false
			};
			_this._callOnItemsRendered = void 0;
			_this._callOnItemsRendered = memoizeOne(function(overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex) {
				return _this.props.onItemsRendered({
					overscanStartIndex,
					overscanStopIndex,
					visibleStartIndex,
					visibleStopIndex
				});
			});
			_this._callOnScroll = void 0;
			_this._callOnScroll = memoizeOne(function(scrollDirection, scrollOffset, scrollUpdateWasRequested) {
				return _this.props.onScroll({
					scrollDirection,
					scrollOffset,
					scrollUpdateWasRequested
				});
			});
			_this._getItemStyle = void 0;
			_this._getItemStyle = function(index) {
				var _this$props = _this.props, direction = _this$props.direction, itemSize = _this$props.itemSize, layout = _this$props.layout;
				var itemStyleCache = _this._getItemStyleCache(shouldResetStyleCacheOnItemSizeChange && itemSize, shouldResetStyleCacheOnItemSizeChange && layout, shouldResetStyleCacheOnItemSizeChange && direction);
				var style;
				if (itemStyleCache.hasOwnProperty(index)) style = itemStyleCache[index];
				else {
					var _offset = getItemOffset(_this.props, index, _this._instanceProps);
					var size = getItemSize(_this.props, index, _this._instanceProps);
					var isHorizontal = direction === "horizontal" || layout === "horizontal";
					var isRtl = direction === "rtl";
					var offsetHorizontal = isHorizontal ? _offset : 0;
					itemStyleCache[index] = style = {
						position: "absolute",
						left: isRtl ? void 0 : offsetHorizontal,
						right: isRtl ? offsetHorizontal : void 0,
						top: !isHorizontal ? _offset : 0,
						height: !isHorizontal ? size : "100%",
						width: isHorizontal ? size : "100%"
					};
				}
				return style;
			};
			_this._getItemStyleCache = void 0;
			_this._getItemStyleCache = memoizeOne(function(_, __, ___) {
				return {};
			});
			_this._onScrollHorizontal = function(event) {
				var _event$currentTarget = event.currentTarget, clientWidth = _event$currentTarget.clientWidth, scrollLeft = _event$currentTarget.scrollLeft, scrollWidth = _event$currentTarget.scrollWidth;
				_this.setState(function(prevState) {
					if (prevState.scrollOffset === scrollLeft) return null;
					var direction = _this.props.direction;
					var scrollOffset = scrollLeft;
					if (direction === "rtl") switch (getRTLOffsetType()) {
						case "negative":
							scrollOffset = -scrollLeft;
							break;
						case "positive-descending":
							scrollOffset = scrollWidth - clientWidth - scrollLeft;
							break;
					}
					scrollOffset = Math.max(0, Math.min(scrollOffset, scrollWidth - clientWidth));
					return {
						isScrolling: true,
						scrollDirection: prevState.scrollOffset < scrollOffset ? "forward" : "backward",
						scrollOffset,
						scrollUpdateWasRequested: false
					};
				}, _this._resetIsScrollingDebounced);
			};
			_this._onScrollVertical = function(event) {
				var _event$currentTarget2 = event.currentTarget, clientHeight = _event$currentTarget2.clientHeight, scrollHeight = _event$currentTarget2.scrollHeight, scrollTop = _event$currentTarget2.scrollTop;
				_this.setState(function(prevState) {
					if (prevState.scrollOffset === scrollTop) return null;
					var scrollOffset = Math.max(0, Math.min(scrollTop, scrollHeight - clientHeight));
					return {
						isScrolling: true,
						scrollDirection: prevState.scrollOffset < scrollOffset ? "forward" : "backward",
						scrollOffset,
						scrollUpdateWasRequested: false
					};
				}, _this._resetIsScrollingDebounced);
			};
			_this._outerRefSetter = function(ref) {
				var outerRef = _this.props.outerRef;
				_this._outerRef = ref;
				if (typeof outerRef === "function") outerRef(ref);
				else if (outerRef != null && typeof outerRef === "object" && outerRef.hasOwnProperty("current")) outerRef.current = ref;
			};
			_this._resetIsScrollingDebounced = function() {
				if (_this._resetIsScrollingTimeoutId !== null) cancelTimeout(_this._resetIsScrollingTimeoutId);
				_this._resetIsScrollingTimeoutId = requestTimeout(_this._resetIsScrolling, IS_SCROLLING_DEBOUNCE_INTERVAL$1);
			};
			_this._resetIsScrolling = function() {
				_this._resetIsScrollingTimeoutId = null;
				_this.setState({ isScrolling: false }, function() {
					_this._getItemStyleCache(-1, null);
				});
			};
			return _this;
		}
		List.getDerivedStateFromProps = function getDerivedStateFromProps(nextProps, prevState) {
			validateSharedProps$1(nextProps, prevState);
			validateProps(nextProps);
			return null;
		};
		var _proto = List.prototype;
		_proto.scrollTo = function scrollTo(scrollOffset) {
			scrollOffset = Math.max(0, scrollOffset);
			this.setState(function(prevState) {
				if (prevState.scrollOffset === scrollOffset) return null;
				return {
					scrollDirection: prevState.scrollOffset < scrollOffset ? "forward" : "backward",
					scrollOffset,
					scrollUpdateWasRequested: true
				};
			}, this._resetIsScrollingDebounced);
		};
		_proto.scrollToItem = function scrollToItem(index, align) {
			if (align === void 0) align = "auto";
			var _this$props2 = this.props, itemCount = _this$props2.itemCount, layout = _this$props2.layout;
			var scrollOffset = this.state.scrollOffset;
			index = Math.max(0, Math.min(index, itemCount - 1));
			var scrollbarSize = 0;
			if (this._outerRef) {
				var outerRef = this._outerRef;
				if (layout === "vertical") scrollbarSize = outerRef.scrollWidth > outerRef.clientWidth ? getScrollbarSize() : 0;
				else scrollbarSize = outerRef.scrollHeight > outerRef.clientHeight ? getScrollbarSize() : 0;
			}
			this.scrollTo(getOffsetForIndexAndAlignment(this.props, index, align, scrollOffset, this._instanceProps, scrollbarSize));
		};
		_proto.componentDidMount = function componentDidMount() {
			var _this$props3 = this.props, direction = _this$props3.direction, initialScrollOffset = _this$props3.initialScrollOffset, layout = _this$props3.layout;
			if (typeof initialScrollOffset === "number" && this._outerRef != null) {
				var outerRef = this._outerRef;
				if (direction === "horizontal" || layout === "horizontal") outerRef.scrollLeft = initialScrollOffset;
				else outerRef.scrollTop = initialScrollOffset;
			}
			this._callPropsCallbacks();
		};
		_proto.componentDidUpdate = function componentDidUpdate() {
			var _this$props4 = this.props, direction = _this$props4.direction, layout = _this$props4.layout;
			var _this$state = this.state, scrollOffset = _this$state.scrollOffset;
			if (_this$state.scrollUpdateWasRequested && this._outerRef != null) {
				var outerRef = this._outerRef;
				if (direction === "horizontal" || layout === "horizontal") if (direction === "rtl") switch (getRTLOffsetType()) {
					case "negative":
						outerRef.scrollLeft = -scrollOffset;
						break;
					case "positive-ascending":
						outerRef.scrollLeft = scrollOffset;
						break;
					default:
						var clientWidth = outerRef.clientWidth;
						outerRef.scrollLeft = outerRef.scrollWidth - clientWidth - scrollOffset;
						break;
				}
				else outerRef.scrollLeft = scrollOffset;
				else outerRef.scrollTop = scrollOffset;
			}
			this._callPropsCallbacks();
		};
		_proto.componentWillUnmount = function componentWillUnmount() {
			if (this._resetIsScrollingTimeoutId !== null) cancelTimeout(this._resetIsScrollingTimeoutId);
		};
		_proto.render = function render() {
			var _this$props5 = this.props, children = _this$props5.children, className = _this$props5.className, direction = _this$props5.direction, height = _this$props5.height, innerRef = _this$props5.innerRef, innerElementType = _this$props5.innerElementType, innerTagName = _this$props5.innerTagName, itemCount = _this$props5.itemCount, itemData = _this$props5.itemData, _this$props5$itemKey = _this$props5.itemKey, itemKey = _this$props5$itemKey === void 0 ? defaultItemKey$1 : _this$props5$itemKey, layout = _this$props5.layout, outerElementType = _this$props5.outerElementType, outerTagName = _this$props5.outerTagName, style = _this$props5.style, useIsScrolling = _this$props5.useIsScrolling, width = _this$props5.width;
			var isScrolling = this.state.isScrolling;
			var isHorizontal = direction === "horizontal" || layout === "horizontal";
			var onScroll = isHorizontal ? this._onScrollHorizontal : this._onScrollVertical;
			var _this$_getRangeToRend = this._getRangeToRender(), startIndex = _this$_getRangeToRend[0], stopIndex = _this$_getRangeToRend[1];
			var items = [];
			if (itemCount > 0) for (var _index = startIndex; _index <= stopIndex; _index++) items.push(createElement(children, {
				data: itemData,
				key: itemKey(_index, itemData),
				index: _index,
				isScrolling: useIsScrolling ? isScrolling : void 0,
				style: this._getItemStyle(_index)
			}));
			var estimatedTotalSize = getEstimatedTotalSize(this.props, this._instanceProps);
			return createElement(outerElementType || outerTagName || "div", {
				className,
				onScroll,
				ref: this._outerRefSetter,
				style: _extends({
					position: "relative",
					height,
					width,
					overflow: "auto",
					WebkitOverflowScrolling: "touch",
					willChange: "transform",
					direction
				}, style)
			}, createElement(innerElementType || innerTagName || "div", {
				children: items,
				ref: innerRef,
				style: {
					height: isHorizontal ? "100%" : estimatedTotalSize,
					pointerEvents: isScrolling ? "none" : void 0,
					width: isHorizontal ? estimatedTotalSize : "100%"
				}
			}));
		};
		_proto._callPropsCallbacks = function _callPropsCallbacks() {
			if (typeof this.props.onItemsRendered === "function") {
				if (this.props.itemCount > 0) {
					var _this$_getRangeToRend2 = this._getRangeToRender(), _overscanStartIndex = _this$_getRangeToRend2[0], _overscanStopIndex = _this$_getRangeToRend2[1], _visibleStartIndex = _this$_getRangeToRend2[2], _visibleStopIndex = _this$_getRangeToRend2[3];
					this._callOnItemsRendered(_overscanStartIndex, _overscanStopIndex, _visibleStartIndex, _visibleStopIndex);
				}
			}
			if (typeof this.props.onScroll === "function") {
				var _this$state2 = this.state, _scrollDirection = _this$state2.scrollDirection, _scrollOffset = _this$state2.scrollOffset, _scrollUpdateWasRequested = _this$state2.scrollUpdateWasRequested;
				this._callOnScroll(_scrollDirection, _scrollOffset, _scrollUpdateWasRequested);
			}
		};
		_proto._getRangeToRender = function _getRangeToRender() {
			var _this$props6 = this.props, itemCount = _this$props6.itemCount, overscanCount = _this$props6.overscanCount;
			var _this$state3 = this.state, isScrolling = _this$state3.isScrolling, scrollDirection = _this$state3.scrollDirection, scrollOffset = _this$state3.scrollOffset;
			if (itemCount === 0) return [
				0,
				0,
				0,
				0
			];
			var startIndex = getStartIndexForOffset(this.props, scrollOffset, this._instanceProps);
			var stopIndex = getStopIndexForStartIndex(this.props, startIndex, scrollOffset, this._instanceProps);
			var overscanBackward = !isScrolling || scrollDirection === "backward" ? Math.max(1, overscanCount) : 1;
			var overscanForward = !isScrolling || scrollDirection === "forward" ? Math.max(1, overscanCount) : 1;
			return [
				Math.max(0, startIndex - overscanBackward),
				Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)),
				startIndex,
				stopIndex
			];
		};
		return List;
	}(PureComponent), _class.defaultProps = {
		direction: "ltr",
		itemData: void 0,
		layout: "vertical",
		overscanCount: 2,
		useIsScrolling: false
	}, _class;
}
var validateSharedProps$1 = function validateSharedProps(_ref2, _ref3) {
	var children = _ref2.children, direction = _ref2.direction, height = _ref2.height, layout = _ref2.layout, innerTagName = _ref2.innerTagName, outerTagName = _ref2.outerTagName, width = _ref2.width;
	var instance = _ref3.instance;
	if (process.env.NODE_ENV !== "production") {
		if (innerTagName != null || outerTagName != null) {
			if (devWarningsTagName$1 && !devWarningsTagName$1.has(instance)) {
				devWarningsTagName$1.add(instance);
				console.warn("The innerTagName and outerTagName props have been deprecated. Please use the innerElementType and outerElementType props instead.");
			}
		}
		var isHorizontal = direction === "horizontal" || layout === "horizontal";
		switch (direction) {
			case "horizontal":
			case "vertical":
				if (devWarningsDirection && !devWarningsDirection.has(instance)) {
					devWarningsDirection.add(instance);
					console.warn("The direction prop should be either \"ltr\" (default) or \"rtl\". Please use the layout prop to specify \"vertical\" (default) or \"horizontal\" orientation.");
				}
				break;
			case "ltr":
			case "rtl": break;
			default: throw Error("An invalid \"direction\" prop has been specified. Value should be either \"ltr\" or \"rtl\". " + ("\"" + direction + "\" was specified."));
		}
		switch (layout) {
			case "horizontal":
			case "vertical": break;
			default: throw Error("An invalid \"layout\" prop has been specified. Value should be either \"horizontal\" or \"vertical\". " + ("\"" + layout + "\" was specified."));
		}
		if (children == null) throw Error("An invalid \"children\" prop has been specified. Value should be a React component. " + ("\"" + (children === null ? "null" : typeof children) + "\" was specified."));
		if (isHorizontal && typeof width !== "number") throw Error("An invalid \"width\" prop has been specified. Horizontal lists must specify a number for width. " + ("\"" + (width === null ? "null" : typeof width) + "\" was specified."));
		else if (!isHorizontal && typeof height !== "number") throw Error("An invalid \"height\" prop has been specified. Vertical lists must specify a number for height. " + ("\"" + (height === null ? "null" : typeof height) + "\" was specified."));
	}
};
var FixedSizeList = /*#__PURE__*/ createListComponent({
	getItemOffset: function getItemOffset(_ref, index) {
		return index * _ref.itemSize;
	},
	getItemSize: function getItemSize(_ref2, index) {
		return _ref2.itemSize;
	},
	getEstimatedTotalSize: function getEstimatedTotalSize(_ref3) {
		var itemCount = _ref3.itemCount;
		return _ref3.itemSize * itemCount;
	},
	getOffsetForIndexAndAlignment: function getOffsetForIndexAndAlignment(_ref4, index, align, scrollOffset, instanceProps, scrollbarSize) {
		var direction = _ref4.direction, height = _ref4.height, itemCount = _ref4.itemCount, itemSize = _ref4.itemSize, layout = _ref4.layout, width = _ref4.width;
		var size = direction === "horizontal" || layout === "horizontal" ? width : height;
		var lastItemOffset = Math.max(0, itemCount * itemSize - size);
		var maxOffset = Math.min(lastItemOffset, index * itemSize);
		var minOffset = Math.max(0, index * itemSize - size + itemSize + scrollbarSize);
		if (align === "smart") if (scrollOffset >= minOffset - size && scrollOffset <= maxOffset + size) align = "auto";
		else align = "center";
		switch (align) {
			case "start": return maxOffset;
			case "end": return minOffset;
			case "center":
				var middleOffset = Math.round(minOffset + (maxOffset - minOffset) / 2);
				if (middleOffset < Math.ceil(size / 2)) return 0;
				else if (middleOffset > lastItemOffset + Math.floor(size / 2)) return lastItemOffset;
				else return middleOffset;
			default: if (scrollOffset >= minOffset && scrollOffset <= maxOffset) return scrollOffset;
			else if (scrollOffset < minOffset) return minOffset;
			else return maxOffset;
		}
	},
	getStartIndexForOffset: function getStartIndexForOffset(_ref5, offset) {
		var itemCount = _ref5.itemCount, itemSize = _ref5.itemSize;
		return Math.max(0, Math.min(itemCount - 1, Math.floor(offset / itemSize)));
	},
	getStopIndexForStartIndex: function getStopIndexForStartIndex(_ref6, startIndex, scrollOffset) {
		var direction = _ref6.direction, height = _ref6.height, itemCount = _ref6.itemCount, itemSize = _ref6.itemSize, layout = _ref6.layout, width = _ref6.width;
		var isHorizontal = direction === "horizontal" || layout === "horizontal";
		var offset = startIndex * itemSize;
		var numVisibleItems = Math.ceil(((isHorizontal ? width : height) + scrollOffset - offset) / itemSize);
		return Math.max(0, Math.min(itemCount - 1, startIndex + numVisibleItems - 1));
	},
	initInstanceProps: function initInstanceProps(props) {},
	shouldResetStyleCacheOnItemSizeChange: true,
	validateProps: function validateProps(_ref7) {
		var itemSize = _ref7.itemSize;
		if (process.env.NODE_ENV !== "production") {
			if (typeof itemSize !== "number") throw Error("An invalid \"itemSize\" prop has been specified. Value should be a number. " + ("\"" + (itemSize === null ? "null" : typeof itemSize) + "\" was specified."));
		}
	}
});
//#endregion
//#region node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer.js
var m;
typeof window < "u" ? m = window : typeof self < "u" ? m = self : m = global;
var R = null, E = null;
var N = 20, y = m.clearTimeout, S = m.setTimeout, F = m.cancelAnimationFrame || m.mozCancelAnimationFrame || m.webkitCancelAnimationFrame, W = m.requestAnimationFrame || m.mozRequestAnimationFrame || m.webkitRequestAnimationFrame;
F == null || W == null ? (R = y, E = function(l) {
	return S(l, N);
}) : (R = function([l, _]) {
	F(l), y(_);
}, E = function(l) {
	const _ = W(function() {
		y(f), l();
	}), f = S(function() {
		F(_), l();
	}, N);
	return [_, f];
});
function D(z) {
	let l, _, f, u, T, r, a;
	const c = typeof document < "u" && document.attachEvent;
	if (!c) {
		r = function(t) {
			const i = t.__resizeTriggers__, h = i.firstElementChild, b = i.lastElementChild, L = h.firstElementChild;
			b.scrollLeft = b.scrollWidth, b.scrollTop = b.scrollHeight, L.style.width = h.offsetWidth + 1 + "px", L.style.height = h.offsetHeight + 1 + "px", h.scrollLeft = h.scrollWidth, h.scrollTop = h.scrollHeight;
		}, T = function(t) {
			return t.offsetWidth !== t.__resizeLast__.width || t.offsetHeight !== t.__resizeLast__.height;
		}, a = function(t) {
			if (t.target.className && typeof t.target.className.indexOf == "function" && t.target.className.indexOf("contract-trigger") < 0 && t.target.className.indexOf("expand-trigger") < 0) return;
			const i = this;
			r(this), this.__resizeRAF__ && R(this.__resizeRAF__), this.__resizeRAF__ = E(function() {
				T(i) && (i.__resizeLast__.width = i.offsetWidth, i.__resizeLast__.height = i.offsetHeight, i.__resizeListeners__.forEach(function(L) {
					L.call(i, t);
				}));
			});
		};
		let e = !1, s = "";
		f = "animationstart";
		const d = "Webkit Moz O ms".split(" ");
		let o = "webkitAnimationStart animationstart oAnimationStart MSAnimationStart".split(" "), p = "";
		{
			const t = document.createElement("fakeelement");
			if (t.style.animationName !== void 0 && (e = !0), e === !1) {
				for (let i = 0; i < d.length; i++) if (t.style[d[i] + "AnimationName"] !== void 0) {
					p = d[i], s = "-" + p.toLowerCase() + "-", f = o[i], e = !0;
					break;
				}
			}
		}
		_ = "resizeanim", l = "@" + s + "keyframes " + _ + " { from { opacity: 0; } to { opacity: 0; } } ", u = s + "animation: 1ms " + _ + "; ";
	}
	const n = function(e) {
		if (!e.getElementById("detectElementResize")) {
			const s = (l || "") + ".resize-triggers { " + (u || "") + "visibility: hidden; opacity: 0; } .resize-triggers, .resize-triggers > div, .contract-trigger:before { content: \" \"; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; z-index: -1; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }", d = e.head || e.getElementsByTagName("head")[0], o = e.createElement("style");
			o.id = "detectElementResize", o.type = "text/css", z != null && o.setAttribute("nonce", z), o.styleSheet ? o.styleSheet.cssText = s : o.appendChild(e.createTextNode(s)), d.appendChild(o);
		}
	};
	return {
		addResizeListener: function(e, s) {
			if (c) e.attachEvent("onresize", s);
			else {
				if (!e.__resizeTriggers__) {
					const d = e.ownerDocument, o = m.getComputedStyle(e);
					o && o.position === "static" && (e.style.position = "relative"), n(d), e.__resizeLast__ = {}, e.__resizeListeners__ = [], (e.__resizeTriggers__ = d.createElement("div")).className = "resize-triggers";
					const p = d.createElement("div");
					p.className = "expand-trigger", p.appendChild(d.createElement("div"));
					const t = d.createElement("div");
					t.className = "contract-trigger", e.__resizeTriggers__.appendChild(p), e.__resizeTriggers__.appendChild(t), e.appendChild(e.__resizeTriggers__), r(e), e.addEventListener("scroll", a, !0), f && (e.__resizeTriggers__.__animationListener__ = function(h) {
						h.animationName === _ && r(e);
					}, e.__resizeTriggers__.addEventListener(f, e.__resizeTriggers__.__animationListener__));
				}
				e.__resizeListeners__.push(s);
			}
		},
		removeResizeListener: function(e, s) {
			if (c) e.detachEvent("onresize", s);
			else if (e.__resizeListeners__.splice(e.__resizeListeners__.indexOf(s), 1), !e.__resizeListeners__.length) {
				e.removeEventListener("scroll", a, !0), e.__resizeTriggers__.__animationListener__ && (e.__resizeTriggers__.removeEventListener(f, e.__resizeTriggers__.__animationListener__), e.__resizeTriggers__.__animationListener__ = null);
				try {
					e.__resizeTriggers__ = !e.removeChild(e.__resizeTriggers__);
				} catch {}
			}
		}
	};
}
function B({ box: z, nonce: l, onResize: _, rootElement: f }) {
	const u = useRef({
		onResize: _,
		parentNode: null,
		prevSize: {
			height: void 0,
			width: void 0
		}
	});
	useLayoutEffect(() => {
		u.current.onResize = _;
	});
	const T = useRef(() => {
		const { onResize: r, parentNode: a, prevSize: c } = u.current;
		if (a === null) return;
		let n, g;
		switch (z) {
			case "border-box": {
				const v = a.getBoundingClientRect();
				n = v.height, g = v.width;
				break;
			}
			case "content-box": {
				const v = a.getBoundingClientRect(), e = window.getComputedStyle(a) || {}, s = parseFloat(e.borderBottomWidth || "0"), d = parseFloat(e.borderLeftWidth || "0"), o = parseFloat(e.borderRightWidth || "0"), p = parseFloat(e.borderTopWidth || "0"), t = parseFloat(e.paddingLeft || "0"), i = parseFloat(e.paddingRight || "0"), h = parseFloat(e.paddingTop || "0"), b = parseFloat(e.paddingBottom || "0");
				n = v.height - h - b - p - s, g = v.width - t - i - d - o;
				break;
			}
			case "device-pixel-content-box":
				n = a.offsetHeight, g = a.offsetWidth;
				break;
		}
		(c.height !== n || c.width !== g) && (u.current.prevSize = {
			height: n,
			width: g
		}, r({
			height: n,
			width: g
		}));
	});
	useLayoutEffect(() => {
		if (f === null) return;
		const r = f.parentNode;
		if (r === null || r.ownerDocument === null || r.ownerDocument.defaultView === null || !(r instanceof r.ownerDocument.defaultView.HTMLElement)) return;
		u.current.parentNode = r;
		const a = T.current, c = r.ownerDocument.defaultView.ResizeObserver;
		if (c != null) {
			let n;
			const g = new c(() => {
				n = setTimeout(a, 0);
			});
			return g.observe(r), () => {
				n && clearTimeout(n), g.disconnect();
			};
		} else {
			const n = D(l);
			return n.addResizeListener(r, a), () => {
				n.removeResizeListener(r, a);
			};
		}
	}, [l, f]);
}
function q({ box: z = "content-box", className: l, "data-testid": _, id: f, nonce: u, onResize: T, style: r, tagName: a = "div", ...c }) {
	let n, g;
	"Child" in c ? n = c.Child : "ChildComponent" in c ? n = c.ChildComponent : "renderProp" in c && (g = c.renderProp);
	const [v, e] = useState(null), [s, d] = useState(), [o, p] = useState();
	B({
		box: z,
		nonce: u,
		onResize: (i) => {
			d(i.height), p(i.width), typeof T < "u" && T(i);
		},
		rootElement: v
	});
	const t = useMemo(() => n ? memo(n) : void 0, [n]);
	return createElement(a, {
		className: l,
		"data-auto-sizer": "",
		"data-testid": _,
		id: f,
		ref: e,
		style: r
	}, t ? createElement(t, {
		height: s,
		width: o
	}) : void 0, g ? g({
		height: s,
		width: o
	}) : void 0);
}
//#endregion
//#region src/audio-player/components/QueueDrawer.tsx
var AutoSizer = q;
var QueueRowWrapper = ({ index, style, data }) => {
	const { visibleQueue, upcomingStart, currentIndex, drag, onPlayTrack, onRemove, isPlaying } = data;
	const actualIndex = upcomingStart + index;
	const track = visibleQueue[index];
	if (!track) return null;
	const isActive = actualIndex === currentIndex;
	const isDragging = drag.drag !== null && drag.drag.index === actualIndex;
	return /* @__PURE__ */ jsx(QueueRow, {
		style,
		track,
		index: actualIndex,
		isActive,
		isDragging,
		dragOffset: isDragging && drag.drag ? drag.drag.y : 0,
		dragHandlers: drag.getRowHandlers(actualIndex),
		onPlay: () => onPlayTrack(actualIndex),
		onRemove: () => onRemove(actualIndex),
		isPlaying
	});
};
/**
* Pure pointer-event drag-and-drop for a vertical list. Returns the drag state
* plus the handlers to attach to each row and the list container. Uses pointer
* capture to survive pointer leaving the element.
*/
function useQueueDrag(itemCount, onReorder, rowHeight = 56, startIndexOffset = 0) {
	const [drag, setDrag] = useState(null);
	const dragRef = useRef(null);
	const containerRef = useRef(null);
	const initialPointerRef = useRef(0);
	const computeTarget = useCallback((pointerY, startIndex) => {
		if (!containerRef.current) return startIndex;
		const offset = pointerY - containerRef.current.getBoundingClientRect().top + containerRef.current.scrollTop;
		const target = Math.round(offset / rowHeight) + startIndexOffset;
		return Math.max(startIndexOffset, Math.min(itemCount - 1, target));
	}, [
		itemCount,
		rowHeight,
		startIndexOffset
	]);
	const handlePointerDown = useCallback((index, event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		initialPointerRef.current = event.clientY;
		const state = {
			index,
			y: 0,
			targetIndex: index
		};
		dragRef.current = state;
		setDrag(state);
	}, []);
	const handlePointerMove = useCallback((event) => {
		const s = dragRef.current;
		if (!s) return;
		event.preventDefault();
		const dy = event.clientY - initialPointerRef.current;
		const target = computeTarget(event.clientY, s.index);
		const next = {
			...s,
			y: dy,
			targetIndex: target === s.index ? s.targetIndex : target
		};
		dragRef.current = next;
		setDrag(next);
	}, [computeTarget]);
	const handlePointerUp = useCallback((event) => {
		const s = dragRef.current;
		if (!s) return;
		event.preventDefault();
		const el = event.currentTarget;
		try {
			el.releasePointerCapture(event.pointerId);
		} catch {}
		const target = computeTarget(event.clientY, s.index);
		if (target !== s.index) onReorder(s.index, target);
		dragRef.current = null;
		setDrag(null);
	}, [computeTarget, onReorder]);
	return {
		drag,
		setContainerRef: containerRef,
		getRowHandlers: (index) => ({
			onPointerDown: (e) => handlePointerDown(index, e),
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp
		})
	};
}
var DragHandleIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 16 16",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "5",
			cy: "4",
			r: "1.3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "11",
			cy: "4",
			r: "1.3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "5",
			cy: "8",
			r: "1.3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "11",
			cy: "8",
			r: "1.3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "5",
			cy: "12",
			r: "1.3"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "11",
			cy: "12",
			r: "1.3"
		})
	]
});
var CloseIcon$1 = () => /* @__PURE__ */ jsxs("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("line", {
		x1: "18",
		y1: "6",
		x2: "6",
		y2: "18"
	}), /* @__PURE__ */ jsx("line", {
		x1: "6",
		y1: "6",
		x2: "18",
		y2: "18"
	})]
});
var RemoveIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "14",
	height: "14",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("line", {
		x1: "18",
		y1: "6",
		x2: "6",
		y2: "18"
	}), /* @__PURE__ */ jsx("line", {
		x1: "6",
		y1: "6",
		x2: "18",
		y2: "18"
	})]
});
function QueueRow({ track, index, isActive, isDragging, dragOffset, dragHandlers, onPlay, onRemove, isPlaying, style }) {
	const rowRef = useRef(null);
	useEffect(() => {
		if (isActive && rowRef.current) rowRef.current.focus();
	}, [isActive]);
	return /* @__PURE__ */ jsxs("div", {
		ref: rowRef,
		className: `ap-q-row${isActive ? " ap-q-row--active" : ""}${isDragging ? " ap-q-row--dragging" : ""}`,
		role: "listitem",
		tabIndex: -1,
		"aria-label": `${track.title} by ${track.artist}${isActive ? " (now playing)" : ""}`,
		style: {
			...style,
			...isDragging && dragOffset !== 0 ? { transform: `translateY(${dragOffset}px)` } : {}
		},
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "ap-q-row__drag",
				"aria-hidden": "true",
				style: { touchAction: "none" },
				onPointerDown: dragHandlers.onPointerDown,
				onPointerMove: dragHandlers.onPointerMove,
				onPointerUp: dragHandlers.onPointerUp,
				children: /* @__PURE__ */ jsx(DragHandleIcon, {})
			}),
			/* @__PURE__ */ jsx("span", {
				className: "ap-q-row__num",
				children: isActive && isPlaying ? /* @__PURE__ */ jsxs("span", {
					className: "ap-eq",
					"aria-hidden": "true",
					children: [
						/* @__PURE__ */ jsx("i", {}),
						/* @__PURE__ */ jsx("i", {}),
						/* @__PURE__ */ jsx("i", {})
					]
				}) : index + 1
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-q-row__meta",
				children: [/* @__PURE__ */ jsx("span", {
					className: "ap-q-row__title",
					children: track.title
				}), /* @__PURE__ */ jsx("span", {
					className: "ap-q-row__artist",
					children: track.artist
				})]
			}),
			isActive && /* @__PURE__ */ jsx("span", {
				className: "ap-q-row__badge",
				children: "Now Playing"
			}),
			!isActive && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "ap-q-row__play-btn ap-tap",
				onClick: onPlay,
				"aria-label": `Play ${track.title}`,
				children: /* @__PURE__ */ jsx("svg", {
					width: "14",
					height: "14",
					viewBox: "0 0 24 24",
					fill: "currentColor",
					"aria-hidden": "true",
					children: /* @__PURE__ */ jsx("path", { d: "M8 5v14l12-7z" })
				})
			}),
			!isActive && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "ap-q-row__remove ap-tap",
				onClick: onRemove,
				"aria-label": `Remove ${track.title} from queue`,
				children: /* @__PURE__ */ jsx(RemoveIcon, {})
			})
		]
	});
}
/**
* An overlay drawer that shows the "Now Playing" track and "Up Next" tracks.
* Supports:
* - Drag-and-drop reorder of upcoming tracks
* - Remove tracks from the queue (not the active track)
* - Click-to-play any upcoming track
* - Accessibility via ARIA roles and live announcements
*
* Designed to work with both the standalone AudioPlayer's local queue and the
* global session's queue (via useAudioSession).
*/
function QueueDrawer({ queue, currentIndex, isPlaying = false, open, onClose, onPlayTrack, onReorder, onRemove }) {
	const [announcement, setAnnouncement] = useState("");
	const prevQueueRef = useRef(queue);
	const upcomingStart = currentIndex;
	const visibleQueue = queue.slice(upcomingStart);
	const drag = useQueueDrag(queue.length, onReorder, 56, upcomingStart);
	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);
	useEffect(() => {
		if (queue.length === prevQueueRef.current.length) return;
		if (prevQueueRef.current.length > queue.length) {
			const removedCount = prevQueueRef.current.length - queue.length;
			setAnnouncement(`${removedCount} track${removedCount > 1 ? "s" : ""} removed from queue`);
		}
		prevQueueRef.current = queue;
	}, [queue]);
	useEffect(() => {
		if (!open) return;
		const handleKey = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);
	if (!open) return null;
	return /* @__PURE__ */ jsxs("div", {
		className: "ap-q-overlay",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Up next queue",
		children: [/* @__PURE__ */ jsx("div", {
			className: "ap-q-backdrop",
			onClick: onClose,
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsxs("div", {
			className: "ap-q-drawer ap-anim-in",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "ap-q-header",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "ap-q-header__title",
							children: "Up Next"
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "ap-q-header__count",
							children: [
								queue.length,
								" track",
								queue.length !== 1 ? "s" : ""
							]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "ap-q-header__close ap-tap",
							onClick: onClose,
							"aria-label": "Close queue drawer",
							children: /* @__PURE__ */ jsx(CloseIcon$1, {})
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "ap-sr-only",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					children: announcement
				}),
				/* @__PURE__ */ jsx("div", {
					className: "ap-q-list",
					role: "list",
					"aria-label": "Queue tracks",
					style: { touchAction: "pan-y" },
					children: /* @__PURE__ */ jsx(AutoSizer, { children: ({ height, width }) => /* @__PURE__ */ jsx(FixedSizeList, {
						outerRef: drag.setContainerRef,
						height,
						width,
						itemCount: visibleQueue.length,
						itemSize: 56,
						itemData: {
							visibleQueue,
							upcomingStart,
							currentIndex,
							drag,
							onPlayTrack,
							onRemove,
							isPlaying
						},
						itemKey: (index, data) => {
							const actualIndex = data.upcomingStart + index;
							const track = data.visibleQueue[index];
							return actualIndex + ":" + trackKey(track);
						},
						children: QueueRowWrapper
					}) })
				}),
				queue.length === 0 && /* @__PURE__ */ jsx("div", {
					className: "ap-q-empty",
					children: /* @__PURE__ */ jsx("p", { children: "Queue is empty" })
				}),
				queue.length > 0 && upcomingStart >= queue.length && /* @__PURE__ */ jsx("div", {
					className: "ap-q-empty",
					children: /* @__PURE__ */ jsx("p", { children: "No more tracks — the queue ends after this one." })
				})
			]
		})]
	});
}
//#endregion
//#region src/audio-player/skins/themeVars.ts
/**
* Build the `--ap-*` CSS custom properties a skin sets on its root, so the
* reused `ProgressBar` / `VolumeControl` (which read `var(--ap-progress)`
* etc.) pick up the right colors — exactly as `.ap-root` does in AudioPlayer.
* Defaults match the player's dark-glass look.
*/
function buildThemeVars(theme = {}) {
	const { accentColor = "#FFFFFF", playIconColor = "#000000", textColor = "#FFFFFF", progressColor = "#FFFFFF", trackColor = "rgba(204, 204, 204, 0.35)", backgroundColor = "rgba(20, 20, 28, 0.6)", glowColor = "transparent", glowIntensity = 100, buttonOpacity = 0 } = theme;
	return {
		"--ap-accent": accentColor,
		"--ap-play-icon": playIconColor,
		"--ap-text": textColor,
		"--ap-progress": progressColor,
		"--ap-track": trackColor,
		"--ap-bg": backgroundColor,
		"--ap-glow": glowColor,
		"--ap-glow-intensity": glowIntensity / 100,
		"--ap-btn-opacity-delta": `${buttonOpacity}%`
	};
}
//#endregion
//#region src/audio-player/components/workspace/workspaceRoutes.ts
/**
* Workspace routing model for the SAP Controller shell.
*
* The SAP Controller started life as a single "…" options sheet. It is now a
* reusable workspace *shell*: the same portal, focus trap, escape handling and
* body-scroll lock host either the legacy options surface (`"options"`) or a
* focused configuration workspace selected from the radial action menu
* (e.g. `"plugin-settings:lyrics"`).
*
* A route is a `category:target` string (the bare `"options"` route has no
* target). Categories group routes by which workspace surface renders them.
* Deliberately free of any engine/session/React imports so the routing model
* can later be promoted into the seihouse-ui design system alongside the menu
* data model.
*/
/** Every workspace route the shell knows how to render. */
var WORKSPACE_ROUTES = [
	"options",
	"library:playlists",
	"library:queue",
	"plugin-settings:lyrics",
	"plugin-settings:waveform",
	"playback:automix",
	"agent:queue-director",
	"visual:canvas",
	"visual:lyrics",
	"diagnostics:activity-log"
];
var ROUTE_SET = new Set(WORKSPACE_ROUTES);
/** Whether an arbitrary string is a known workspace route. */
function isWorkspaceRoute(value) {
	return ROUTE_SET.has(value);
}
/**
* Validate and categorize a route string. Returns `null` for any value that is
* not a known route, so callers can fall back to `"options"` (or ignore an
* unrecognized node) rather than render an empty shell.
*/
function parseWorkspaceRoute(value) {
	if (!value || !isWorkspaceRoute(value)) return null;
	if (value === "options") return {
		route: value,
		category: "options",
		target: null
	};
	const sep = value.indexOf(":");
	return {
		route: value,
		category: value.slice(0, sep),
		target: value.slice(sep + 1)
	};
}
//#endregion
//#region src/audio-player/components/workspace/LibraryPlaylistsWorkspace.tsx
function LibraryPlaylistsWorkspace() {
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: "Playlists coming soon"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "Browse, build and reorder playlists from here."
		})]
	});
}
//#endregion
//#region src/audio-player/components/workspace/LibraryQueueWorkspace.tsx
function LibraryQueueWorkspace() {
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: "Up Next"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "An in-workspace view of the play queue is on the way. Use the queue drawer for now."
		})]
	});
}
//#endregion
//#region src/audio-player/components/workspace/PluginSettingsWorkspace.tsx
function PluginSettingsWorkspace({ pluginId }) {
	const label = pluginId ? pluginId.charAt(0).toUpperCase() + pluginId.slice(1) : "Plugin";
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsxs("p", {
			className: "sap-ctl__workspace-lead",
			children: [label, " settings"]
		}), /* @__PURE__ */ jsxs("p", {
			className: "sap-ctl__workspace-sub",
			children: [
				"Configuration for the ",
				label,
				" plugin will appear here."
			]
		})]
	});
}
//#endregion
//#region src/audio-player/components/workspace/PlaybackAutomixWorkspace.tsx
function PlaybackAutomixWorkspace() {
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: "Automix settings coming soon"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "Crossfade length, beat snapping and transition tuning will live here."
		})]
	});
}
//#endregion
//#region src/audio-player/components/workspace/AgentQueueDirectorWorkspace.tsx
function AgentQueueDirectorWorkspace() {
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: "AI queue director coming soon"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "Let an agent curate and reorder what plays next."
		})]
	});
}
//#endregion
//#region src/audio-player/diagnostics/useActivityLog.ts
/**
* useActivityLog — React hook for consuming the Activity Log context.
*
* Provides the full ActivityLogApi (record, events, clear, exportJson,
* exportText) to any component in the tree. Throws with a clear error
* message when used outside an ActivityLogProvider.
*/
var ActivityLogContext = createContext(null);
/**
* Read the Activity Log from context. Throws if used outside an
* ActivityLogProvider.
*/
function useOptionalActivityLog() {
	return useContext(ActivityLogContext);
}
function useActivityLog() {
	const ctx = useOptionalActivityLog();
	if (!ctx) throw new Error("useActivityLog must be used within an <ActivityLogProvider>");
	return ctx;
}
//#endregion
//#region src/audio-player/diagnostics/activityTypes.ts
var DEFAULT_ACTIVITY_LOG_CONFIG = { maxEntries: 200 };
//#endregion
//#region src/audio-player/diagnostics/activityLogStore.ts
/** Create a standalone activity log store. Callers can create multiple stores
*  (e.g. one for a session, one for a plugin) or share a single global one. */
function createActivityLogStore(config) {
	const { maxEntries } = {
		...DEFAULT_ACTIVITY_LOG_CONFIG,
		...config
	};
	const buffer = [];
	let nextId = 1;
	/** Non-blocking record. Wraps the entire operation in a try-catch so no
	*  caller ever has to worry about a bad entry crashing playback. */
	function record(entry) {
		try {
			const safeEntry = normalizeEntry(entry);
			const event = {
				id: nextId++,
				timestamp: Date.now(),
				area: safeEntry.area,
				status: safeEntry.status,
				message: safeEntry.message
			};
			if (safeEntry.details != null) event.details = safeEntry.details;
			if (safeEntry.error != null) event.error = safeEntry.error;
			buffer.push(event);
			if (buffer.length > maxEntries) buffer.splice(0, buffer.length - maxEntries);
		} catch {}
	}
	/** Clear all stored events. */
	function clear() {
		buffer.length = 0;
		nextId = 1;
	}
	/** Export as JSON — newest first. */
	function exportJson() {
		try {
			return JSON.stringify([...buffer].reverse(), null, 2);
		} catch {
			return "[]";
		}
	}
	/** Export as plain text — one line per event, newest first. */
	function exportText() {
		try {
			return [...buffer].reverse().map(formatLine).join("\n");
		} catch {
			return "";
		}
	}
	return {
		record,
		get events() {
			return buffer;
		},
		clear,
		exportJson,
		exportText,
		maxEntries,
		get count() {
			return buffer.length;
		}
	};
}
function pad2$1(n) {
	return n < 10 ? "0" + n : String(n);
}
function formatTimestamp(ts) {
	const d = new Date(ts);
	return pad2$1(d.getHours()) + ":" + pad2$1(d.getMinutes()) + ":" + pad2$1(d.getSeconds()) + "." + String(d.getMilliseconds()).padStart(3, "0");
}
var VALID_AREAS$1 = new Set([
	"plugin",
	"player",
	"canvas",
	"agent",
	"playback",
	"session",
	"system"
]);
var VALID_STATUSES$1 = new Set([
	"info",
	"warn",
	"error",
	"success"
]);
function normalizeEntry(entry) {
	const candidate = entry != null && typeof entry === "object" ? entry : {};
	return {
		area: VALID_AREAS$1.has(candidate.area) ? candidate.area : "system",
		status: VALID_STATUSES$1.has(candidate.status) ? candidate.status : "warn",
		message: String(candidate.message ?? "Malformed activity event"),
		details: candidate.details,
		error: candidate.error == null ? void 0 : String(candidate.error)
	};
}
var STATUS_PAD = 5;
var AREA_PAD = 8;
function formatLine(event) {
	let line = `[${formatTimestamp(event.timestamp)}] ${event.status.padEnd(STATUS_PAD)} ${event.area.padEnd(AREA_PAD)} ${event.message}`;
	if (event.error) line += ` | error: ${event.error}`;
	if (event.details) try {
		const detailStr = JSON.stringify(event.details);
		if (detailStr.length > 200) line += ` | ${detailStr.slice(0, 200)}…`;
		else line += ` | ${detailStr}`;
	} catch {}
	return line;
}
//#endregion
//#region src/audio-player/diagnostics/ActivityLogPanel.tsx
/**
* ActivityLogPanel — the settings-panel UI for viewing, filtering, copying,
* clearing, and exporting the current session's activity log.
*
* Renders inside the SAP Controller workspace shell. Uses VirtualList-style
* rendering via a simple scroll-to-top-on-filter-change pattern. All actions
* (clear, copy, export) are self-contained in this component.
*/
var AREA_LABELS = {
	plugin: "Plugin",
	player: "Player",
	canvas: "Canvas",
	agent: "Agent",
	playback: "Playback",
	session: "Session",
	system: "System"
};
var STATUS_CLASS = {
	info: "al-event--info",
	warn: "al-event--warn",
	error: "al-event--error",
	success: "al-event--success"
};
var VALID_AREAS = new Set(Object.keys(AREA_LABELS));
var VALID_STATUSES = new Set(Object.keys(STATUS_CLASS));
function ActivityLogPanel() {
	const contextLog = useOptionalActivityLog();
	const fallbackLogRef = useRef(null);
	if (!fallbackLogRef.current) fallbackLogRef.current = createActivityLogStore();
	const log = contextLog ?? fallbackLogRef.current;
	const listRef = useRef(null);
	const [filters, setFilters] = useState({
		status: "all",
		area: "all",
		search: ""
	});
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		listRef.current?.scrollTo({ top: 0 });
	}, [filters]);
	const filtered = useMemo(() => {
		let result = getSafeEvents(log.events);
		if (filters.status !== "all") result = result.filter((e) => e.status === filters.status);
		if (filters.area !== "all") result = result.filter((e) => e.area === filters.area);
		if (filters.search.trim()) {
			const q = filters.search.toLowerCase();
			result = result.filter((e) => e.message.toLowerCase().includes(q) || e.error && e.error.toLowerCase().includes(q));
		}
		return result;
	}, [log.events, filters]);
	const handleStatusChange = useCallback((e) => {
		setFilters((f) => ({
			...f,
			status: e.target.value
		}));
	}, []);
	const handleAreaChange = useCallback((e) => {
		setFilters((f) => ({
			...f,
			area: e.target.value
		}));
	}, []);
	const handleSearchChange = useCallback((e) => {
		setFilters((f) => ({
			...f,
			search: e.target.value
		}));
	}, []);
	const handleClear = useCallback(() => {
		log.clear();
	}, [log]);
	const handleCopy = useCallback(() => {
		try {
			navigator.clipboard.writeText(log.exportText()).then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2e3);
			}, () => {});
		} catch {}
	}, [log]);
	const handleExportJson = useCallback(() => {
		downloadLog(log.exportJson(), `activity-log-${Date.now()}.json`, "application/json");
	}, [log]);
	const handleExportText = useCallback(() => {
		downloadLog(log.exportText(), `activity-log-${Date.now()}.txt`, "text/plain");
	}, [log]);
	return /* @__PURE__ */ jsxs("div", {
		className: "al",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "al__toolbar",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "al__filters",
					children: [
						/* @__PURE__ */ jsxs("select", {
							className: "al__select",
							value: filters.status,
							onChange: handleStatusChange,
							"aria-label": "Filter by status",
							children: [
								/* @__PURE__ */ jsx("option", {
									value: "all",
									children: "All status"
								}),
								/* @__PURE__ */ jsx("option", {
									value: "info",
									children: "Info"
								}),
								/* @__PURE__ */ jsx("option", {
									value: "warn",
									children: "Warn"
								}),
								/* @__PURE__ */ jsx("option", {
									value: "error",
									children: "Error"
								}),
								/* @__PURE__ */ jsx("option", {
									value: "success",
									children: "Success"
								})
							]
						}),
						/* @__PURE__ */ jsxs("select", {
							className: "al__select",
							value: filters.area,
							onChange: handleAreaChange,
							"aria-label": "Filter by area",
							children: [/* @__PURE__ */ jsx("option", {
								value: "all",
								children: "All areas"
							}), Object.keys(AREA_LABELS).map((area) => /* @__PURE__ */ jsx("option", {
								value: area,
								children: AREA_LABELS[area]
							}, area))]
						}),
						/* @__PURE__ */ jsx("input", {
							className: "al__search",
							type: "search",
							placeholder: "Search messages…",
							value: filters.search,
							onChange: handleSearchChange,
							"aria-label": "Search activity log"
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "al__actions",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: "al__btn al__btn--copy",
							onClick: handleCopy,
							"aria-label": copied ? "Copied" : "Copy log",
							title: copied ? "Copied!" : "Copy to clipboard",
							children: [copied ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx("span", { className: "al__icon-copy" }), copied ? "Copied" : "Copy"]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "al__btn al__btn--export",
							onClick: handleExportText,
							"aria-label": "Export as text",
							title: "Export as .txt",
							children: "TXT"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "al__btn al__btn--export",
							onClick: handleExportJson,
							"aria-label": "Export as JSON",
							title: "Export as .json",
							children: "JSON"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "al__btn al__btn--clear",
							onClick: handleClear,
							"aria-label": "Clear log",
							title: "Clear all events",
							children: "Clear"
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "al__badge",
				children: [
					filtered.length,
					" / ",
					log.count,
					" event",
					log.count !== 1 ? "s" : "",
					filters.status !== "all" || filters.area !== "all" || filters.search.trim() ? " (filtered)" : ""
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "al__list",
				ref: listRef,
				children: filtered.length === 0 ? /* @__PURE__ */ jsx("div", {
					className: "al__empty",
					children: log.count === 0 ? "No events recorded yet." : "No events match the current filters."
				}) : filtered.map((event) => /* @__PURE__ */ jsx(ActivityEventRow, { event }, event.id))
			})
		]
	});
}
function ActivityEventRow({ event }) {
	const [expanded, setExpanded] = useState(false);
	const time = formatEventTime(event.timestamp);
	const statusClass = STATUS_CLASS[event.status];
	const hasDetails = event.details != null || event.error != null || event.message.length > 120;
	return /* @__PURE__ */ jsxs("div", {
		className: `al-event ${statusClass}${expanded ? " al-event--expanded" : ""}`,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			className: "al-event__summary",
			onClick: () => setExpanded((v) => !v),
			"aria-expanded": expanded,
			"aria-label": expanded ? "Collapse event details" : "Expand event details",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "al-event__time",
					children: time
				}),
				/* @__PURE__ */ jsx("span", {
					className: `al-event__status al-event__status--${event.status}`,
					children: event.status
				}),
				/* @__PURE__ */ jsx("span", {
					className: "al-event__area",
					children: AREA_LABELS[event.area]
				}),
				/* @__PURE__ */ jsx("span", {
					className: "al-event__msg",
					children: event.message
				}),
				hasDetails && /* @__PURE__ */ jsx("span", {
					className: "al-event__chevron",
					"aria-hidden": "true",
					children: expanded ? "▾" : "▸"
				})
			]
		}), expanded && hasDetails && /* @__PURE__ */ jsxs("div", {
			className: "al-event__details",
			children: [
				event.error && /* @__PURE__ */ jsxs("div", {
					className: "al-event__detail-row",
					children: [/* @__PURE__ */ jsx("span", {
						className: "al-event__detail-label",
						children: "Error"
					}), /* @__PURE__ */ jsx("code", {
						className: "al-event__detail-val al-event__detail-val--error",
						children: event.error
					})]
				}),
				event.details && /* @__PURE__ */ jsxs("div", {
					className: "al-event__detail-row",
					children: [/* @__PURE__ */ jsx("span", {
						className: "al-event__detail-label",
						children: "Details"
					}), /* @__PURE__ */ jsx("code", {
						className: "al-event__detail-val",
						children: formatDetails(event.details)
					})]
				}),
				event.message.length > 120 && /* @__PURE__ */ jsxs("div", {
					className: "al-event__detail-row",
					children: [/* @__PURE__ */ jsx("span", {
						className: "al-event__detail-label",
						children: "Message"
					}), /* @__PURE__ */ jsx("code", {
						className: "al-event__detail-val",
						children: event.message
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "al-event__detail-row",
					children: [/* @__PURE__ */ jsx("span", {
						className: "al-event__detail-label",
						children: "ID"
					}), /* @__PURE__ */ jsxs("code", {
						className: "al-event__detail-val",
						children: ["#", event.id]
					})]
				})
			]
		})]
	});
}
function getSafeEvents(events) {
	if (!Array.isArray(events)) return [];
	return events.map(toSafeEvent).filter((event) => event != null);
}
function toSafeEvent(event) {
	if (event == null || typeof event !== "object") return null;
	const candidate = event;
	const area = VALID_AREAS.has(candidate.area) ? candidate.area : "system";
	const status = VALID_STATUSES.has(candidate.status) ? candidate.status : "warn";
	const message = String(candidate.message ?? "Malformed activity event");
	const timestamp = typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp) ? candidate.timestamp : Date.now();
	const id = typeof candidate.id === "number" && Number.isFinite(candidate.id) ? candidate.id : timestamp;
	return {
		...candidate,
		id,
		timestamp,
		area,
		status,
		message,
		error: candidate.error == null ? void 0 : String(candidate.error)
	};
}
function formatEventTime(ts) {
	const d = new Date(ts);
	return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}
function pad2(n) {
	return n < 10 ? "0" + n : String(n);
}
function formatDetails(details) {
	try {
		return JSON.stringify(details, null, 2);
	} catch {
		return String(details);
	}
}
function downloadLog(content, filename, mime) {
	try {
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.rel = "noopener";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch {}
}
//#endregion
//#region src/audio-player/diagnostics/ActivityLogWorkspace.tsx
/**
* ActivityLogWorkspace — the workspace surface that wraps the ActivityLogPanel
* for the SAP Controller shell.
*
* This is the route destination for "diagnostics:activity-log". It provides
* a scroll-ready container and the panel itself.
*/
function ActivityLogWorkspace() {
	return /* @__PURE__ */ jsx(ActivityLogPanel, {});
}
//#endregion
//#region src/audio-player/visual-slots/ControllerPanelRenderer.tsx
/**
* Renders a registered component's `SettingsPanel` inside the SAPController
* workspace sheet, wired to the per-player settings store. Used by the lyrics
* workspace route to edit the lyric display's settings; edits flow straight back
* to the live SEI Canvas visual through context.
*/
function ControllerPanelRenderer({ componentId, lyrics }) {
	const slots = useVisualSlots();
	const def = getVisualComponent(componentId);
	if (!def || !def.SettingsPanel) return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: def?.name ?? "Settings"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "This visual has no configurable settings."
		})]
	});
	const { SettingsPanel } = def;
	return /* @__PURE__ */ jsx(SettingsPanel, {
		settings: slots.getSettings(def.id),
		onChange: (partial) => slots.updateSettings(def.id, partial),
		lyrics
	});
}
//#endregion
//#region src/audio-player/visual-slots/VisualSlotPicker.tsx
/**
* Segmented-control picker that lists every visual component registered for a
* slot, plus a "None" option. Selecting an entry calls `setActive` on the
* per-player visual-slot store; the corresponding renderer picks it up
* immediately through context.
*
* Mounted inside the `visual:canvas` workspace route so the Canvas page becomes
* "choose a visual + tune it".
*/
function VisualSlotPicker({ slot = "seiCanvas" }) {
	const { getActive, setActive } = useVisualSlots();
	const components = getVisualComponentsForSlot(slot);
	const activeId = getActive(slot);
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-visual-switcher",
		children: [/* @__PURE__ */ jsx("span", {
			className: "sap-visual-switcher__label",
			children: "Choose Visual"
		}), /* @__PURE__ */ jsxs("div", {
			className: "sap-visual-switcher__list",
			children: [components.map((def) => /* @__PURE__ */ jsx("button", {
				type: "button",
				className: `sap-visual-switcher__btn${activeId === def.id ? " sap-visual-switcher__btn--active" : ""}`,
				onClick: () => setActive(slot, def.id),
				"aria-pressed": activeId === def.id,
				children: def.name
			}, def.id)), /* @__PURE__ */ jsx("button", {
				type: "button",
				className: `sap-visual-switcher__btn${activeId === null ? " sap-visual-switcher__btn--active" : ""}`,
				onClick: () => setActive(slot, null),
				"aria-pressed": activeId === null,
				children: "None"
			}, "__none__")]
		})]
	});
}
//#endregion
//#region src/audio-player/components/workspace/WorkspaceShell.tsx
/** Human title for the sheet header, keyed by route. */
function titleForRoute(route) {
	switch (route) {
		case "library:playlists": return "Playlists";
		case "library:queue": return "Up Next";
		case "plugin-settings:lyrics":
		case "visual:lyrics": return "Lyrics";
		case "plugin-settings:waveform": return "Waveform";
		case "playback:automix": return "Automix";
		case "agent:queue-director": return "Queue Director";
		case "diagnostics:activity-log": return "Activity Log";
		case "visual:canvas": return "Canvas";
		default: return "Workspace";
	}
}
/**
* The visual:canvas workspace content: a slot picker at the top and the active
* visual's settings panel below it. Extracted as its own component because it
* needs hooks (useVisualSlots) and `contentForRoute` is a plain function.
*/
function VisualCanvasWorkspace({ lyrics }) {
	const { getActive } = useVisualSlots();
	const activeId = getActive("seiCanvas");
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(VisualSlotPicker, { slot: "seiCanvas" }), activeId ? /* @__PURE__ */ jsx(ControllerPanelRenderer, {
		componentId: activeId,
		lyrics
	}) : /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: "No Visual"
		}), /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "Select a visual above to configure it."
		})]
	})] });
}
/**
* Pick the placeholder workspace surface for a route. Switches on the full route
* string for known routes (parity with `titleForRoute`) so a future `library:*`
* or `playback:*` route can't silently fall through to the wrong surface; the
* `default` only parses for the genuinely dynamic `plugin-settings:<id>` case.
*/
function contentForRoute(route, lyrics) {
	switch (route) {
		case "library:playlists": return /* @__PURE__ */ jsx(LibraryPlaylistsWorkspace, {});
		case "library:queue": return /* @__PURE__ */ jsx(LibraryQueueWorkspace, {});
		case "plugin-settings:lyrics":
		case "visual:lyrics": return /* @__PURE__ */ jsx(ControllerPanelRenderer, {
			componentId: LYRIC_DISPLAY_ID,
			lyrics
		});
		case "playback:automix": return /* @__PURE__ */ jsx(PlaybackAutomixWorkspace, {});
		case "agent:queue-director": return /* @__PURE__ */ jsx(AgentQueueDirectorWorkspace, {});
		case "diagnostics:activity-log": return /* @__PURE__ */ jsx(ActivityLogWorkspace, {});
		case "visual:canvas": return /* @__PURE__ */ jsx(VisualCanvasWorkspace, { lyrics });
		default: {
			const parsed = parseWorkspaceRoute(route);
			if (parsed?.category === "plugin-settings" && parsed.target) return /* @__PURE__ */ jsx(PluginSettingsWorkspace, { pluginId: parsed.target });
			return null;
		}
	}
}
function WorkspaceShell({ route, onClose, lyrics }) {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("header", {
		className: "sap-ctl__header",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "sap-ctl__title",
			children: titleForRoute(route)
		}), /* @__PURE__ */ jsx("button", {
			type: "button",
			className: "sap-ctl__close ap-tap",
			onClick: onClose,
			"aria-label": "Close workspace",
			children: /* @__PURE__ */ jsx(CloseIcon$2, {})
		})]
	}), /* @__PURE__ */ jsx("div", {
		className: "sap-ctl__workspace",
		"data-route": route,
		children: contentForRoute(route, lyrics)
	})] });
}
//#endregion
//#region src/audio-player/components/SAPController.tsx
function Section({ title, children }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "sap-ctl__section",
		"aria-label": title,
		children: [/* @__PURE__ */ jsx("h3", {
			className: "sap-ctl__heading",
			children: title
		}), children]
	});
}
function SwitchRow({ icon, label, on, onToggle }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		className: "sap-ctl__row ap-tap",
		role: "switch",
		"aria-checked": on,
		onClick: onToggle,
		children: [/* @__PURE__ */ jsxs("span", {
			className: "sap-ctl__label",
			children: [icon, label]
		}), /* @__PURE__ */ jsx("span", {
			className: `sap-ctl__switch${on ? " sap-ctl__switch--on" : ""}`,
			"aria-hidden": "true",
			children: /* @__PURE__ */ jsx("span", { className: "sap-ctl__knob" })
		})]
	});
}
var CloseIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("line", {
		x1: "6",
		y1: "6",
		x2: "18",
		y2: "18"
	}), /* @__PURE__ */ jsx("line", {
		x1: "18",
		y1: "6",
		x2: "6",
		y2: "18"
	})]
});
function KaraokeLyrics({ lyrics }) {
	const { currentTime } = useAudioSession();
	const parsed = useMemo(() => {
		const lines = lyrics.split("\n");
		const result = [];
		for (const line of lines) {
			const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/);
			if (match) {
				const m = parseInt(match[1], 10);
				const s = parseFloat(match[2]);
				result.push({
					time: m * 60 + s,
					text: match[3].trim()
				});
			} else result.push({
				time: -1,
				text: line
			});
		}
		return result;
	}, [lyrics]);
	const containerRef = useRef(null);
	if (!parsed.some((l) => l.time >= 0)) return /* @__PURE__ */ jsx("div", {
		className: "sap-ctl__lyrics",
		children: lyrics
	});
	let activeIndex = -1;
	for (let i = 0; i < parsed.length; i++) if (parsed[i].time >= 0 && currentTime >= parsed[i].time) activeIndex = i;
	useEffect(() => {
		if (activeIndex >= 0 && containerRef.current) {
			const container = containerRef.current;
			const el = container.children[activeIndex];
			if (el) {
				const containerRect = container.getBoundingClientRect();
				const elRect = el.getBoundingClientRect();
				const relativeTop = elRect.top - containerRect.top + container.scrollTop;
				container.scrollTo({
					top: relativeTop - containerRect.height / 2 + elRect.height / 2,
					behavior: "smooth"
				});
			}
		}
	}, [activeIndex]);
	return /* @__PURE__ */ jsx("div", {
		className: "sap-ctl__lyrics sap-ctl__lyrics--karaoke",
		ref: containerRef,
		children: parsed.map((line, idx) => /* @__PURE__ */ jsx("div", {
			className: `sap-ctl__lyric-line ${idx === activeIndex ? "sap-ctl__lyric-line--active" : ""}`,
			children: line.text || "\xA0"
		}, idx))
	});
}
function SAPController({ open, onClose, route = "options", playback, queue, info, share, pluginNames, waveform, accentColor, playIconColor, textColor, progressColor, trackColor, backgroundColor }) {
	const sheetRef = useRef(null);
	const closeRef = useRef(null);
	const [lyricsOpen, setLyricsOpen] = useState(false);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);
	useEffect(() => {
		if (!open) return;
		const opener = document.activeElement;
		const raf = requestAnimationFrame(() => {
			if (closeRef.current) closeRef.current.focus();
			else sheetRef.current?.querySelector("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")?.focus();
		});
		const handleKey = (e) => {
			if (e.key === "Escape") onCloseRef.current();
		};
		document.addEventListener("keydown", handleKey);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener("keydown", handleKey);
			if (opener?.isConnected) opener.focus();
		};
	}, [open]);
	useEffect(() => {
		if (!open) setLyricsOpen(false);
	}, [open]);
	const handleTrapKeyDown = (event) => {
		if (event.key !== "Tab" || !sheetRef.current) return;
		const focusables = Array.from(sheetRef.current.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement;
		if (!active || !sheetRef.current.contains(active)) {
			event.preventDefault();
			(event.shiftKey ? last : first).focus();
		} else if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	};
	if (!open || typeof document === "undefined") return null;
	const themeVars = buildThemeVars({
		accentColor,
		playIconColor,
		textColor,
		progressColor,
		trackColor,
		backgroundColor
	});
	const isOptions = route === "options";
	return createPortal(/* @__PURE__ */ jsxs("div", {
		className: "sap-ctl",
		style: themeVars,
		children: [/* @__PURE__ */ jsx("div", {
			className: "sap-ctl__backdrop",
			onClick: onClose,
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsxs("div", {
			ref: sheetRef,
			className: "sap-ctl__sheet",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": isOptions ? "Player options" : "Player workspace",
			onKeyDown: handleTrapKeyDown,
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "sap-ctl__grab",
					"aria-hidden": "true"
				}),
				!isOptions && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(WorkspaceShell, {
					route,
					onClose,
					lyrics: info?.lyrics
				}), /* @__PURE__ */ jsx("div", {
					className: "sap-ctl__divider",
					role: "separator",
					"aria-hidden": "true"
				})] }),
				/* @__PURE__ */ jsxs("header", {
					className: "sap-ctl__header",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "sap-ctl__title",
						children: isOptions ? "Options" : "Options"
					}), /* @__PURE__ */ jsx("button", {
						ref: closeRef,
						type: "button",
						className: "sap-ctl__close ap-tap",
						onClick: onClose,
						"aria-label": isOptions ? "Close player options" : "Close workspace",
						children: /* @__PURE__ */ jsx(CloseIcon, {})
					})]
				}),
				playback && /* @__PURE__ */ jsxs(Section, {
					title: "Playback",
					children: [
						/* @__PURE__ */ jsx(SwitchRow, {
							icon: /* @__PURE__ */ jsx(ShuffleIcon, {}),
							label: "Shuffle",
							on: playback.shuffle,
							onToggle: playback.onToggleShuffle
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: "sap-ctl__row ap-tap",
							onClick: playback.onCycleRepeat,
							"aria-label": `Repeat: ${playback.repeatMode}. Activate to change.`,
							children: [/* @__PURE__ */ jsxs("span", {
								className: "sap-ctl__label",
								children: [playback.repeatMode === "one" ? /* @__PURE__ */ jsx(RepeatOneIcon, {}) : /* @__PURE__ */ jsx(RepeatIcon, {}), "Repeat"]
							}), /* @__PURE__ */ jsx("span", {
								className: "sap-ctl__value",
								children: playback.repeatMode
							})]
						}),
						playback.onToggleAutomix && /* @__PURE__ */ jsx(SwitchRow, {
							icon: /* @__PURE__ */ jsx(AutomixIcon, {}),
							label: "Automix",
							on: playback.automix ?? false,
							onToggle: playback.onToggleAutomix
						}),
						playback.onToggleAutoPlay && /* @__PURE__ */ jsx(SwitchRow, {
							icon: /* @__PURE__ */ jsx(AutoPlayIcon, {}),
							label: "Auto Play",
							on: playback.autoPlay ?? false,
							onToggle: playback.onToggleAutoPlay
						})
					]
				}),
				queue && /* @__PURE__ */ jsx(Section, {
					title: "Queue",
					children: /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "sap-ctl__row ap-tap",
						onClick: () => {
							onClose();
							queue.onOpenQueue();
						},
						children: [/* @__PURE__ */ jsxs("span", {
							className: "sap-ctl__label",
							children: [/* @__PURE__ */ jsx(QueueIcon, {}), "Up Next"]
						}), /* @__PURE__ */ jsxs("span", {
							className: "sap-ctl__value",
							children: [
								queue.count,
								" track",
								queue.count !== 1 ? "s" : ""
							]
						})]
					})
				}),
				info && /* @__PURE__ */ jsxs(Section, {
					title: "Info",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "sap-ctl__meta",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "sap-ctl__meta-row",
								children: [/* @__PURE__ */ jsx("span", {
									className: "sap-ctl__meta-key",
									children: "Track"
								}), /* @__PURE__ */ jsx("span", {
									className: "sap-ctl__meta-val",
									children: info.title
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "sap-ctl__meta-row",
								children: [/* @__PURE__ */ jsx("span", {
									className: "sap-ctl__meta-key",
									children: "Artist"
								}), /* @__PURE__ */ jsx("span", {
									className: "sap-ctl__meta-val",
									children: info.artist
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "sap-ctl__meta-row",
								children: [/* @__PURE__ */ jsx("span", {
									className: "sap-ctl__meta-key",
									children: "Length"
								}), /* @__PURE__ */ jsx("span", {
									className: "sap-ctl__meta-val",
									children: Number.isFinite(info.duration) && info.duration > 0 ? formatTime(info.duration) : "–:––"
								})]
							})
						]
					}), info.lyrics && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "sap-ctl__row ap-tap",
						onClick: () => setLyricsOpen((v) => !v),
						"aria-expanded": lyricsOpen,
						children: [/* @__PURE__ */ jsxs("span", {
							className: "sap-ctl__label",
							children: [/* @__PURE__ */ jsx(LyricsIcon, {}), "Lyrics"]
						}), /* @__PURE__ */ jsx("span", {
							className: "sap-ctl__value",
							children: lyricsOpen ? "hide" : "show"
						})]
					}), lyricsOpen && /* @__PURE__ */ jsx(KaraokeLyrics, { lyrics: info.lyrics })] })]
				}),
				share && /* @__PURE__ */ jsx(Section, {
					title: "Share",
					children: /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "sap-ctl__row ap-tap",
						onClick: share.onShare,
						children: [/* @__PURE__ */ jsxs("span", {
							className: "sap-ctl__label",
							children: [share.copied ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(ShareIcon, {}), "Share"]
						}), share.copied && /* @__PURE__ */ jsx("span", {
							className: "sap-ctl__value",
							children: "copied"
						})]
					})
				}),
				waveform && /* @__PURE__ */ jsx(Section, {
					title: "Visual",
					children: /* @__PURE__ */ jsx(SwitchRow, {
						icon: /* @__PURE__ */ jsx(WaveIcon, {}),
						label: "Show Waveform",
						on: waveform.enabled,
						onToggle: waveform.onToggle
					})
				}),
				pluginNames && pluginNames.length > 0 && /* @__PURE__ */ jsx(Section, {
					title: "Plugins",
					children: /* @__PURE__ */ jsx("ul", {
						className: "sap-ctl__plugins",
						children: pluginNames.map((name) => /* @__PURE__ */ jsxs("li", {
							className: "sap-ctl__plugin",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "sap-ctl__label",
								children: [/* @__PURE__ */ jsx(PluginIcon, {}), name]
							}), /* @__PURE__ */ jsx("span", {
								className: "sap-ctl__value",
								children: "active"
							})]
						}, name))
					})
				})
			]
		})]
	}), document.body);
}
//#endregion
//#region src/audio-player/components/HoldSkipButton.tsx
var DEFAULT_HOLD_MS = 1200;
/**
* Consolidated transport button: a short press seeks, an intentional hold skips
* tracks. Pointer and keyboard paths share the same timer so mobile, desktop,
* and assistive keyboard users get equivalent behavior.
*/
function HoldSkipButton({ direction, disabled = false, skipDisabled = false, seekLabel, skipLabel, onSeek, onSkip, children, className = "", holdMs = DEFAULT_HOLD_MS }) {
	const hintId = useId();
	const timerRef = useRef(null);
	const heldRef = useRef(false);
	const pressingRef = useRef(false);
	const [isHolding, setIsHolding] = useState(false);
	const clearHoldTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);
	const resetHold = useCallback(() => {
		clearHoldTimer();
		pressingRef.current = false;
		heldRef.current = false;
		setIsHolding(false);
	}, [clearHoldTimer]);
	const startHold = useCallback(() => {
		if (disabled || pressingRef.current) return;
		pressingRef.current = true;
		heldRef.current = false;
		setIsHolding(!skipDisabled);
		if (skipDisabled) return;
		timerRef.current = window.setTimeout(() => {
			heldRef.current = true;
			pressingRef.current = false;
			setIsHolding(false);
			onSkip();
		}, holdMs);
	}, [
		disabled,
		holdMs,
		onSkip,
		skipDisabled
	]);
	const finishPress = useCallback(() => {
		if (disabled || !pressingRef.current) {
			resetHold();
			return;
		}
		const completedHold = heldRef.current;
		resetHold();
		if (!completedHold) onSeek();
	}, [
		disabled,
		onSeek,
		resetHold
	]);
	const cancelPress = useCallback(() => {
		resetHold();
	}, [resetHold]);
	useEffect(() => {
		resetHold();
	}, [
		resetHold,
		disabled,
		skipDisabled
	]);
	const handlePointerDown = (event) => {
		if (event.button !== 0) return;
		startHold();
	};
	const handlePointerEnd = (_event) => {
		finishPress();
	};
	const handleKeyDown = (event) => {
		if (event.key !== " " && event.key !== "Enter") return;
		if (event.repeat) return;
		event.preventDefault();
		startHold();
	};
	const handleKeyUp = (event) => {
		if (event.key !== " " && event.key !== "Enter") return;
		event.preventDefault();
		finishPress();
	};
	const label = `${seekLabel}; hold for ${skipLabel.toLowerCase()}`;
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		className: `${className} ap-hold-skip ap-hold-skip--${direction}${isHolding ? " ap-hold-skip--holding" : ""}`.trim(),
		style: { "--ap-hold-ms": `${holdMs}ms` },
		disabled,
		"aria-label": label,
		"aria-describedby": hintId,
		"data-hold-label": skipDisabled ? "Unavailable" : "Hold",
		onPointerDown: handlePointerDown,
		onPointerUp: handlePointerEnd,
		onPointerCancel: cancelPress,
		onPointerLeave: cancelPress,
		onKeyDown: handleKeyDown,
		onKeyUp: handleKeyUp,
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "ap-hold-skip__icon",
				"aria-hidden": "true",
				children
			}),
			/* @__PURE__ */ jsx("span", {
				className: "ap-hold-skip__progress",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsxs("span", {
				id: hintId,
				className: "ap-sr-only",
				children: [
					"Tap to ",
					seekLabel.toLowerCase(),
					". Hold for about one second for ",
					skipLabel.toLowerCase(),
					"."
				]
			})
		]
	});
}
//#endregion
//#region src/audio-player/components/useShareTrack.ts
function useShareTrack(title, artist) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef(null);
	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
		};
	}, []);
	return {
		share: useCallback(() => {
			if (typeof window === "undefined") return;
			const url = window.location.href;
			const text = `${title} by ${artist}`;
			if (navigator.share) navigator.share({
				title: text,
				url
			}).catch(() => {});
			else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => {
				if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
				setCopied(true);
				timeoutRef.current = setTimeout(() => setCopied(false), 2e3);
			}).catch(() => {});
		}, [title, artist]),
		copied,
		nativeShare: typeof navigator !== "undefined" && typeof navigator.share === "function"
	};
}
//#endregion
//#region src/audio-player/components/useReducedMotion.ts
var QUERY = "(prefers-reduced-motion: reduce)";
/**
* Tracks the user's `prefers-reduced-motion` setting and updates if it changes
* mid-session. SSR-safe: with no `window`/`matchMedia` it reports `false`, the
* motion-on default, matching the server render.
*/
function useReducedMotion() {
	const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY).matches : false);
	useEffect(() => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
		const mq = window.matchMedia(QUERY);
		const onChange = () => setReduced(mq.matches);
		onChange();
		mq.addEventListener?.("change", onChange);
		return () => mq.removeEventListener?.("change", onChange);
	}, []);
	return reduced;
}
//#endregion
//#region src/audio-player/utils/formatMetadata.ts
/** Title for display, falling back to a labeled placeholder when empty. */
function getDisplayTitle(track, fallback = "Unknown Track") {
	return track?.title?.trim() || fallback;
}
/** Artist for display, falling back to a labeled placeholder when empty. */
function getDisplayArtist(track, fallback = "Unknown Artist") {
	return track?.artist?.trim() || fallback;
}
/** Append a version qualifier in parentheses, e.g. `Title (Radio Edit)`. */
function formatVersionedTitle(title, versionLabel) {
	const version = versionLabel?.trim();
	return version ? `${title} (${version})` : title;
}
/**
* Compose the "feat. …" suffix from a list of featured artists, dropping blanks.
* One name → `feat. A`; many → `feat. A, B & C`. Empty list → `""`.
*/
function formatFeatured(featuredArtists) {
	const names = (featuredArtists ?? []).map((n) => n?.trim()).filter((n) => Boolean(n));
	if (names.length === 0) return "";
	if (names.length === 1) return `feat. ${names[0]}`;
	const last = names[names.length - 1];
	return `feat. ${names.slice(0, -1).join(", ")} & ${last}`;
}
/**
* The secondary line: `Artist [feat. …] [· Album]`. Album wins the trailing
* slot; when there's neither album nor featured artists, an optional `subtitle`
* fills it instead.
*/
function formatSecondaryLine(track, artistFallback = "Unknown Artist") {
	const artist = getDisplayArtist(track, artistFallback);
	const featured = formatFeatured(track?.featuredArtists);
	const lead = featured ? `${artist} ${featured}` : artist;
	const album = track?.albumTitle?.trim();
	const subtitle = !featured ? track?.subtitle?.trim() : "";
	const trailing = album || subtitle || "";
	return trailing ? `${lead} · ${trailing}` : lead;
}
/**
* Decide whether a marquee should scroll: only when the text actually overflows
* its container, motion is allowed, and the container is wide enough to be worth
* it. A 1px slack avoids sub-pixel false positives.
*/
function shouldEnableMarquee({ contentWidth, containerWidth, reducedMotion, minWidth = 200 }) {
	if (reducedMotion) return false;
	if (containerWidth < minWidth) return false;
	return contentWidth - containerWidth > 1;
}
//#endregion
//#region src/audio-player/components/TextMarquee.tsx
/**
* Scrolls long text horizontally, but only when it genuinely overflows its
* container. Overflow is measured with a ResizeObserver (RAF-debounced, never in
* a render loop), and the scroll is a single GPU-composited transform driven by
* CSS. When the text fits, or the user prefers reduced motion, it falls back to
* static ellipsis truncation. The full text stays in one DOM node, so screen
* readers read it once. Pauses on hover/focus (handled in CSS).
*/
function TextMarquee({ children, className, title, disabled = false, minWidth = 200, secondsPer100px = 3 }) {
	const containerRef = useRef(null);
	const innerRef = useRef(null);
	const reducedMotion = useReducedMotion();
	const [distance, setDistance] = useState(0);
	useEffect(() => {
		const container = containerRef.current;
		const inner = innerRef.current;
		if (!container || !inner) return;
		if (disabled || reducedMotion || typeof ResizeObserver === "undefined") {
			setDistance(0);
			return;
		}
		let rafId = 0;
		const measure = () => {
			const containerWidth = container.clientWidth;
			const contentWidth = inner.scrollWidth;
			setDistance(shouldEnableMarquee({
				contentWidth,
				containerWidth,
				reducedMotion,
				minWidth
			}) ? contentWidth - containerWidth : 0);
		};
		const schedule = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(measure);
		};
		const observer = new ResizeObserver(schedule);
		observer.observe(container);
		observer.observe(inner);
		schedule();
		return () => {
			cancelAnimationFrame(rafId);
			observer.disconnect();
		};
	}, [
		children,
		disabled,
		reducedMotion,
		minWidth
	]);
	const scrolling = distance > 0;
	const travel = distance + 8;
	const style = scrolling ? {
		"--ap-marquee-distance": `${travel}px`,
		"--ap-marquee-duration": `${Math.max(6, travel / 100 * secondsPer100px)}s`
	} : void 0;
	return /* @__PURE__ */ jsx("div", {
		ref: containerRef,
		className: `ap-marquee${className ? ` ${className}` : ""}`,
		"data-scroll": scrolling ? "true" : "false",
		title,
		style,
		children: /* @__PURE__ */ jsx("span", {
			ref: innerRef,
			className: "ap-marquee__inner",
			children
		})
	});
}
//#endregion
//#region src/audio-player/components/TrackMetadata.tsx
/** Small "E" badge marking explicit content. Decorative glyph, real label. */
function ExplicitBadge({ className }) {
	return /* @__PURE__ */ jsx("span", {
		className: `ap-explicit-badge${className ? ` ${className}` : ""}`,
		"aria-label": "Explicit content",
		title: "Explicit content",
		children: "E"
	});
}
/**
* The shared title / artist / album hierarchy. A single, accessible building
* block so every face presents metadata identically: primary line (title +
* version + explicit badge), secondary line (artist + featured + album), and an
* optional tertiary release line. Display-only — it reads a few optional Track
* fields and nothing else.
*/
function TrackMetadata({ track, variant = "compact", enableMarquee = false, showTertiary = false, titleFallback = "Unknown Track", artistFallback = "Unknown Artist", className }) {
	const title = formatVersionedTitle(getDisplayTitle(track, titleFallback), track?.versionLabel);
	const artist = getDisplayArtist(track, artistFallback);
	const featured = formatFeatured(track?.featuredArtists);
	const album = track?.albumTitle?.trim();
	const subtitle = !featured ? track?.subtitle?.trim() : "";
	const trailing = album || subtitle || "";
	const release = track?.releaseTitle?.trim();
	const secondaryText = [
		artist,
		featured,
		trailing
	].filter(Boolean).join(" ");
	const primary = /* @__PURE__ */ jsxs(Fragment, { children: [title, track?.explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})] });
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-meta ap-meta--${variant}${className ? ` ${className}` : ""}`,
		"data-variant": variant,
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "ap-meta__primary",
				dir: "auto",
				children: enableMarquee ? /* @__PURE__ */ jsx(TextMarquee, {
					className: "ap-meta__title",
					title,
					children: primary
				}) : /* @__PURE__ */ jsx("span", {
					className: "ap-meta__title",
					title,
					children: primary
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-meta__secondary",
				title: secondaryText,
				dir: "auto",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "ap-meta__artist",
						children: artist
					}),
					featured && /* @__PURE__ */ jsxs("span", {
						className: "ap-meta__featured",
						"aria-label": `featuring ${track?.featuredArtists?.join(", ") ?? ""}`,
						children: [" ", featured]
					}),
					trailing && /* @__PURE__ */ jsxs("span", {
						className: "ap-meta__album",
						children: [/* @__PURE__ */ jsx("span", {
							className: "ap-meta__sep",
							"aria-hidden": "true",
							children: " · "
						}), trailing]
					})
				]
			}),
			showTertiary && release && release !== album && /* @__PURE__ */ jsx("div", {
				className: "ap-meta__tertiary",
				title: release,
				children: release
			})
		]
	});
}
//#endregion
//#region src/audio-player/utils/useArtworkColor.ts
/**
* Extracts the average RGB color from an image URL using a hidden canvas.
* Falls back to null if the image fails to load or CORS prevents extraction.
*/
function useArtworkColor(src) {
	const [color, setColor] = useState(null);
	useEffect(() => {
		if (!src) {
			setColor(null);
			return;
		}
		let isMounted = true;
		const img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = () => {
			if (!isMounted) return;
			try {
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				if (!ctx) return;
				canvas.width = 64;
				canvas.height = 64;
				ctx.drawImage(img, 0, 0, 64, 64);
				const imageData = ctx.getImageData(0, 0, 64, 64).data;
				let r = 0, g = 0, b = 0, totalAlpha = 0;
				for (let i = 0; i < imageData.length; i += 4) {
					const a = imageData[i + 3];
					r += imageData[i] * a;
					g += imageData[i + 1] * a;
					b += imageData[i + 2] * a;
					totalAlpha += a;
				}
				if (totalAlpha === 0) setColor(null);
				else setColor(`rgb(${Math.round(r / totalAlpha)}, ${Math.round(g / totalAlpha)}, ${Math.round(b / totalAlpha)})`);
			} catch (err) {
				if (isMounted) setColor(null);
			}
		};
		img.onerror = () => {
			if (isMounted) setColor(null);
		};
		img.src = src;
		return () => {
			isMounted = false;
			img.onload = null;
			img.onerror = null;
		};
	}, [src]);
	return color;
}
//#endregion
//#region src/audio-player/utils/device.ts
/**
* Lightweight client device detection, used to decide UI defaults that depend
* on platform capability rather than viewport size.
*
* Why this exists: iOS Safari (and several other mobile browsers) ignore
* programmatic `volume` changes on HTML5 audio — only the `muted` attribute is
* honored. Rendering a volume slider there implies a control that does nothing,
* so skins hide the slider by default on mobile and surface the mute button
* instead. The `useAudioPlayer` engine still detects the unsupported case at
* runtime (`volumeUnsupported`); this is the *default-visibility* heuristic so
* the slider never appears in the first place on touch devices.
*
* All checks are SSR-safe: with no `window`/`navigator` they report "not
* mobile", which keeps the desktop default (volume shown) on the server.
*/
/**
* iOS / iPadOS detection. Covers classic iPhone/iPod/iPad user agents plus
* iPadOS 13+, which masquerades as desktop Safari ("MacIntel") but exposes a
* touch screen via `maxTouchPoints`.
*/
function isIOS() {
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent || "";
	if (/iPad|iPhone|iPod/.test(ua)) return true;
	return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
/**
* Best-effort "is this a phone/tablet touch browser" check. Combines a
* user-agent signal with a feature-detection fallback (coarse pointer + touch
* capability) so it still resolves correctly on UAs the regex doesn't list.
*/
function isMobileDevice() {
	if (typeof window === "undefined" || typeof navigator === "undefined") return false;
	if (isIOS()) return true;
	const ua = navigator.userAgent || "";
	if (/Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
	const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
	const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
	return hasTouch && coarsePointer;
}
/**
* The default visibility for volume *sliders* in skins. Desktop keeps the
* slider; mobile hides it (mute remains the reliable control). Skins still
* accept an explicit `showVolume` prop, which always wins over this default.
*/
function defaultShowVolume() {
	return !isMobileDevice();
}
//#endregion
//#region src/audio-player/utils/trackList.ts
var EMPTY_TRACKS = [];
function resolveTrackList(tracks) {
	return tracks ?? EMPTY_TRACKS;
}
//#endregion
//#region src/audio-player/AudioPlayer.tsx
var TrackRow = memo(({ index, style, data }) => {
	const { queue, currentIndex, onPlay, isPlaying } = data;
	const track = queue[index];
	if (!track) return null;
	const active = index === currentIndex;
	return /* @__PURE__ */ jsx("div", {
		style,
		role: "listitem",
		children: /* @__PURE__ */ jsxs("button", {
			type: "button",
			className: "ap-tracklist__item" + (active ? " ap-tracklist__item--active" : ""),
			onClick: () => onPlay(index),
			"aria-current": active ? "true" : void 0,
			style: {
				height: "calc(100% - 4px)",
				width: "100%",
				boxSizing: "border-box"
			},
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "ap-tracklist__num",
					children: index + 1
				}),
				/* @__PURE__ */ jsxs("span", {
					className: "ap-tracklist__meta",
					children: [/* @__PURE__ */ jsx("span", {
						className: "ap-tracklist__title",
						children: track.title
					}), /* @__PURE__ */ jsx("span", {
						className: "ap-tracklist__artist",
						children: track.artist
					})]
				}),
				active && isPlaying && /* @__PURE__ */ jsxs("span", {
					className: "ap-eq",
					"aria-hidden": "true",
					children: [
						/* @__PURE__ */ jsx("i", {}),
						/* @__PURE__ */ jsx("i", {}),
						/* @__PURE__ */ jsx("i", {})
					]
				})
			]
		})
	});
});
var DEFAULT_AUDIO = "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3";
var EMPTY_PLUGINS = [];
function trackPeaksSignature(peaks) {
	if (!peaks) return "";
	return peaks.map((channel) => {
		const last = channel.length > 0 ? channel[channel.length - 1] : "";
		return `${channel.length}:${channel[0] ?? ""}:${last}`;
	}).join(",");
}
function trackListSignature(tracks) {
	return JSON.stringify(tracks.map((track) => [
		trackKey(track),
		track.title ?? "",
		track.artist ?? "",
		track.audioFile ?? "",
		trackSourcesSignature(track),
		track.purchaseUrl ?? "",
		track.lyrics ?? "",
		track.waveformDuration ?? null,
		trackPeaksSignature(track.peaks)
	]));
}
/**
* React error boundary wrapping the player body. Keeps an unexpected render
* error in a child component (slider, menu, etc.) from crashing the entire
* host app. The fallback surfaces a minimal message and a way to retry the
* render attempt.
*/
var AudioPlayerErrorBoundary = class extends Component {
	state = { error: null };
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error) {
		console.error("[AudioPlayer] render error:", error);
	}
	handleReset = () => {
		this.setState({ error: null });
	};
	render() {
		if (this.state.error) return /* @__PURE__ */ jsxs("div", {
			className: "ap-error-boundary",
			role: "alert",
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "ap-error-boundary__title",
					children: this.props.fallbackTitle
				}),
				/* @__PURE__ */ jsx("p", {
					className: "ap-error-boundary__message",
					children: this.state.error.message
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ap-retry-btn",
					onClick: this.handleReset,
					children: "Retry"
				})
			]
		});
		return this.props.children;
	}
};
/**
* The standalone, self-contained player (`PLAYER_FACE_CAPABILITIES.portable`).
*
* Main is *the better version of the FullCardPlayer*, not a different player:
* it runs on the exact same `AudioSessionProvider` engine every other skin
* uses. Rather than require the host to wrap it, `AudioPlayer` provides its own
* session internally from its flat props (`title`/`artist`/`audioFile` or a
* `tracks` playlist), so standalone usage is unchanged while the queue,
* shuffle/repeat/automix logic, plugin pipeline, and end-of-track advance are
* all owned by the shared session — no duplicated playback engine.
*
* Full-featured portable player with complete surface infrastructure support:
* - `SEICanvasHost` for plugin visual areas (canvas toggle + Up Next queue)
* - `ScrubberCanvasHost` + `WaveformAdapter` for unified scrubber waveform
* - `PlayerSurfaceButtons` providing:
*   - Left: SEI Canvas toggle button
*   - Right: `SEICanvasActionMenu` (radial command wheel)
* - `SAPController` for deep actions (shuffle, repeat, automix, autoplay,
*   queue, info, share, plugins) — shared with the arc menu via workspace routes
*
* The arc menu and "..." button share a single SAPController instance, with
* workspace routes determining which focused panel displays (e.g. Lyrics,
* Automix, Plugin Settings). This matches the FullCardPlayer architecture.
*
* Waveform display is controlled by:
* 1. Explicit `showWaveform` prop (highest priority)
* 2. WaveformPlugin presence + toggle state
* 3. Falls back to basic progress bar
*
* Mobile volume follows `defaultShowVolume()` default (visible on desktop,
* hidden on touch).
*/
function AudioPlayer(props) {
	return /* @__PURE__ */ jsx(AudioPlayerErrorBoundary, {
		fallbackTitle: "Audio player failed to render",
		children: /* @__PURE__ */ jsx(AudioPlayerInner, { ...props })
	});
}
/**
* Outer shell: resolves props into a session queue and provides its own
* `AudioSessionProvider`, so the body below is a true session skin (like
* `FullCardPlayer`) instead of a parallel engine. The provider owns the single
* `<audio>` element, the queue/shuffle/repeat/automix logic, the plugin
* pipeline, and end-of-track advance.
*/
function AudioPlayerInner(props) {
	const { tracks: tracksProp, audioFile = DEFAULT_AUDIO, title = "Audio Track", artist = "Artist Name", purchaseUrl = "", lyrics = "", autoPlay = false, loop = false, shuffle = false, repeatMode: repeatModeProp, automix = false, plugins: externalPlugins = EMPTY_PLUGINS, audioBackend = "html5", onFallbackSource } = props;
	const tracks = resolveTrackList(tracksProp);
	const isPlaylistMode = tracks.length > 0;
	const initialQueue = useMemo(() => isPlaylistMode ? tracks : [{
		title,
		artist,
		audioFile,
		fallbackSources: props.fallbackSources,
		sources: props.sources,
		purchaseUrl,
		lyrics
	}], [
		isPlaylistMode,
		tracks,
		title,
		artist,
		audioFile,
		props.fallbackSources,
		props.sources,
		purchaseUrl,
		lyrics
	]);
	const queueSignature = useMemo(() => trackListSignature(initialQueue), [initialQueue]);
	return /* @__PURE__ */ jsx(AudioSessionProvider, {
		initialQueue,
		autoPlay,
		shuffle,
		repeatMode: repeatModeProp ?? (loop ? "one" : "off"),
		automix,
		plugins: externalPlugins,
		audioBackend,
		onFallbackSource,
		children: /* @__PURE__ */ jsx(AudioPlayerBody, {
			...props,
			isPlaylistMode,
			resolvedQueue: initialQueue,
			queueSignature
		})
	});
}
function AudioPlayerBody(props) {
	const { isPlaylistMode, resolvedQueue, queueSignature, audioFile = DEFAULT_AUDIO, title = "Audio Track", artist = "Artist Name", purchaseUrl = "", lyrics = "", autoPlay = false, backgroundImage, backgroundMedia, blurSize = 20, darkenAmount = 0, showTracklist = false, showVolume = defaultShowVolume(), showWaveform, waveformHeight = 48, titleFont, artistFont, accentColor = "#FFFFFF", playIconColor = "#000000", textColor = "#FFFFFF", progressColor = "#FFFFFF", trackColor = "rgba(204, 204, 204, 0.35)", backgroundColor = "rgba(255, 255, 255, 0)", glowColor = "transparent", glowIntensity = 100, buttonOpacity = 0, plugins: externalPlugins = EMPTY_PLUGINS, className, style } = props;
	const s = useAudioSession();
	const [announcement, setAnnouncement] = useState("");
	const [controllerOpen, setControllerOpen] = useState(false);
	const [localAutoPlay, setLocalAutoPlay] = useState(autoPlay);
	const [queueOpen, setQueueOpen] = useState(false);
	const surface = usePlayerSurface("portable");
	const [controllerRoute, setControllerRoute] = useState("options");
	const rootRef = useRef(null);
	const previousQueueSignatureRef = useRef(queueSignature);
	const hasWaveformPlugin = useMemo(() => externalPlugins.some((plugin) => plugin.providesWaveform), [externalPlugins]);
	const hasKeyboardShortcutPlugin = useMemo(() => externalPlugins.some((plugin) => plugin.handlesKeyboardShortcuts), [externalPlugins]);
	const [waveformEnabled, setWaveformEnabled] = useState(true);
	const [prevHasWaveformPlugin, setPrevHasWaveformPlugin] = useState(hasWaveformPlugin);
	if (hasWaveformPlugin !== prevHasWaveformPlugin) {
		setPrevHasWaveformPlugin(hasWaveformPlugin);
		if (hasWaveformPlugin) setWaveformEnabled(true);
	}
	const effectiveWaveform = showWaveform ?? (hasWaveformPlugin ? waveformEnabled : false);
	useEffect(() => {
		if (previousQueueSignatureRef.current === queueSignature) return;
		previousQueueSignatureRef.current = queueSignature;
		const current = s.currentIndex < 0 ? 0 : s.currentIndex;
		const nextIndex = Math.min(current, Math.max(0, resolvedQueue.length - 1));
		s.setQueue(resolvedQueue, nextIndex, false);
	}, [queueSignature]);
	const [prevAutoPlay, setPrevAutoPlay] = useState(autoPlay);
	if (autoPlay !== prevAutoPlay) {
		setPrevAutoPlay(autoPlay);
		setLocalAutoPlay(autoPlay);
	}
	const { currentTrack: sessionTrack, currentIndex, queue, isPlaying, currentTime, duration, buffered, volume, isMuted, isBuffering, isSeeking, hasError, errorMessage, hasAudio, currentSrc, volumeUnsupported, autoplayBlocked, shuffle, repeatMode, automix, canNext, canPrevious } = s;
	const currentTrack = sessionTrack ?? {
		title,
		artist,
		audioFile,
		fallbackSources: props.fallbackSources,
		sources: props.sources,
		purchaseUrl,
		lyrics
	};
	const sourceKey = sessionTrack ? `${currentIndex}:${trackKey(sessionTrack)}:${trackSourcesSignature(sessionTrack)}` : "empty";
	const showPlaySpinner = isBuffering;
	const canPreviousTrack = isPlaylistMode && canPrevious;
	const canNextTrack = isPlaylistMode && canNext;
	const handleAutoPlayToggle = useCallback(() => setLocalAutoPlay((v) => !v), []);
	const handleQueuePlayTrack = useCallback((index) => {
		s.playTrack(index);
		setQueueOpen(false);
	}, [s]);
	const { share, copied: shareCopied, nativeShare } = useShareTrack(currentTrack.title ?? "", currentTrack.artist ?? "");
	const handleShareClick = useCallback(() => {
		if (nativeShare) setControllerOpen(false);
		share();
	}, [nativeShare, share]);
	const handleCloseController = useCallback(() => {
		setControllerOpen(false);
		setControllerRoute("options");
	}, []);
	const handleOpenFocusedController = useCallback((route) => {
		setControllerRoute(route);
		setControllerOpen(true);
	}, []);
	const handleOpenOptions = useCallback(() => {
		setControllerRoute("options");
		setControllerOpen(true);
	}, []);
	const handleRootKeyDown = useCallback((event) => {
		if (hasKeyboardShortcutPlugin) return;
		const onInteractive = !!event.target.closest("button, a, input, [role='slider']");
		const key = event.key.toLowerCase();
		if ((event.key === " " || key === "k") && !onInteractive) {
			event.preventDefault();
			s.toggle();
		} else if (key === "j") {
			event.preventDefault();
			s.seekBy(-10);
		} else if (key === "l") {
			event.preventDefault();
			s.seekBy(10);
		} else if (key === "n" && isPlaylistMode) {
			event.preventDefault();
			s.next();
		} else if (key === "p" && isPlaylistMode) {
			event.preventDefault();
			s.previous();
		}
	}, [
		hasKeyboardShortcutPlugin,
		isPlaylistMode,
		s
	]);
	const lastPlayedRef = useRef(null);
	const lastErrorRef = useRef(null);
	const lastAutoplayRef = useRef(null);
	const lastMissingRef = useRef(null);
	useEffect(() => {
		if (lastPlayedRef.current !== isPlaying) {
			lastPlayedRef.current = isPlaying;
			if (isPlaying) setAnnouncement(`Playing ${currentTrack.title} by ${currentTrack.artist}`);
		}
	}, [
		isPlaying,
		currentTrack.title,
		currentTrack.artist
	]);
	useEffect(() => {
		const msg = errorMessage || "";
		if (lastErrorRef.current !== msg && hasError) {
			lastErrorRef.current = msg;
			setAnnouncement(`Error: ${msg}`);
		} else if (!hasError) lastErrorRef.current = null;
	}, [hasError, errorMessage]);
	useEffect(() => {
		if (lastAutoplayRef.current !== autoplayBlocked) {
			lastAutoplayRef.current = autoplayBlocked;
			if (autoplayBlocked) setAnnouncement("Autoplay blocked. Tap play to start audio.");
		}
	}, [autoplayBlocked]);
	useEffect(() => {
		if (lastMissingRef.current !== hasAudio) {
			lastMissingRef.current = hasAudio;
			if (!hasAudio) setAnnouncement("Audio file missing");
		}
	}, [hasAudio]);
	const artworkSrc = useMemo(() => {
		const candidates = [
			currentTrack.artwork,
			backgroundMedia?.src,
			backgroundImage?.src
		];
		for (const value of candidates) {
			const resolved = resolveArtworkSrc(value);
			if (resolved) return resolved;
		}
	}, [
		currentTrack.artwork,
		backgroundMedia?.src,
		backgroundImage?.src
	]);
	const artwork = useMemo(() => artworkSrc ? buildMediaSessionArtwork(artworkSrc) : [], [artworkSrc]);
	const dynamicColor = useArtworkColor(artworkSrc);
	useMediaSessionObserver(s, {
		title: currentTrack.title,
		artist: currentTrack.artist,
		album: currentTrack.albumTitle ?? "",
		artwork,
		onNext: canNextTrack ? s.next : void 0,
		onPrevious: canPreviousTrack ? s.previous : void 0,
		sourceKey
	});
	const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" ? true : document.visibilityState !== "hidden");
	useEffect(() => {
		if (typeof document === "undefined") return;
		const onVis = () => setPageVisible(document.visibilityState !== "hidden");
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, []);
	const themeVars = {
		"--ap-accent": accentColor?.toUpperCase() === "#FFFFFF" && dynamicColor ? dynamicColor : accentColor,
		"--ap-play-icon": playIconColor,
		"--ap-text": textColor,
		"--ap-progress": progressColor?.toUpperCase() === "#FFFFFF" && dynamicColor ? dynamicColor : progressColor,
		"--ap-track": trackColor,
		"--ap-bg": backgroundColor,
		"--ap-glow": glowColor === "transparent" && dynamicColor ? dynamicColor : glowColor,
		"--ap-glow-intensity": glowIntensity / 100,
		"--ap-btn-opacity-delta": `${buttonOpacity}%`,
		"--ap-blur": `${blurSize}px`
	};
	const trackListData = useMemo(() => ({
		queue,
		currentIndex,
		onPlay: s.playTrack,
		isPlaying
	}), [
		queue,
		currentIndex,
		s.playTrack,
		isPlaying
	]);
	return /* @__PURE__ */ jsx(VisualSlotsProvider, { children: /* @__PURE__ */ jsxs("div", {
		ref: rootRef,
		className: `ap-root${className ? ` ${className}` : ""}${pageVisible ? "" : " ap-root--hidden"}`,
		style: {
			...themeVars,
			...style
		},
		role: "region",
		"aria-label": "Audio player",
		onKeyDown: handleRootKeyDown,
		children: [
			isPlaylistMode && /* @__PURE__ */ jsx(QueueDrawer, {
				queue,
				currentIndex,
				isPlaying,
				open: queueOpen,
				onClose: () => setQueueOpen(false),
				onPlayTrack: handleQueuePlayTrack,
				onReorder: s.moveQueueItem,
				onRemove: s.removeFromQueue
			}),
			/* @__PURE__ */ jsx(SAPController, {
				open: controllerOpen,
				onClose: handleCloseController,
				route: controllerRoute,
				playback: {
					shuffle,
					onToggleShuffle: s.toggleShuffle,
					repeatMode,
					onCycleRepeat: s.cycleRepeat,
					...isPlaylistMode ? {
						automix,
						onToggleAutomix: s.toggleAutomix
					} : {},
					autoPlay: localAutoPlay,
					onToggleAutoPlay: handleAutoPlayToggle
				},
				queue: isPlaylistMode ? {
					count: queue.length,
					onOpenQueue: () => setQueueOpen(true)
				} : void 0,
				info: {
					title: currentTrack.title ?? "",
					artist: currentTrack.artist ?? "",
					duration,
					lyrics: currentTrack.lyrics
				},
				share: {
					onShare: handleShareClick,
					copied: shareCopied
				},
				pluginNames: externalPlugins.map((plugin) => plugin.name),
				waveform: hasWaveformPlugin ? {
					enabled: waveformEnabled,
					onToggle: () => setWaveformEnabled((v) => !v)
				} : void 0,
				accentColor,
				playIconColor,
				textColor,
				progressColor,
				trackColor,
				backgroundColor
			}),
			/* @__PURE__ */ jsx("div", {
				className: "ap-sr-only",
				role: "status",
				"aria-live": "polite",
				"aria-atomic": "true",
				children: announcement
			}),
			/* @__PURE__ */ jsx(BackgroundMedia, {
				...resolveMedia({
					media: backgroundMedia,
					legacyImage: backgroundImage
				}),
				darkenAmount
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-content",
				children: [
					!hasAudio && /* @__PURE__ */ jsxs("div", {
						className: "ap-banner ap-banner--error ap-anim-in",
						children: [/* @__PURE__ */ jsx(ErrorIcon, {}), /* @__PURE__ */ jsx("span", { children: "Audio file missing" })]
					}),
					autoplayBlocked && hasAudio && !hasError && /* @__PURE__ */ jsxs("div", {
						className: "ap-banner ap-banner--info ap-banner--col ap-anim-in",
						role: "status",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "ap-banner__row",
							children: [/* @__PURE__ */ jsx(InfoIcon, {}), /* @__PURE__ */ jsx("span", { children: "Autoplay blocked. Tap play to start audio." })]
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "ap-retry-btn",
							onClick: () => {
								s.dismissAutoplayBlocked();
								s.toggle();
							},
							children: "Play"
						})]
					}),
					hasError && hasAudio && /* @__PURE__ */ jsxs("div", {
						className: "ap-banner ap-banner--error ap-banner--col ap-anim-in",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "ap-banner__row",
							children: [/* @__PURE__ */ jsx(ErrorIcon, {}), /* @__PURE__ */ jsx("span", { children: errorMessage })]
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "ap-retry-btn",
							onClick: s.retry,
							children: "Retry"
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "ap-top-actions",
						children: /* @__PURE__ */ jsx("div", {
							className: "ap-menu",
							children: /* @__PURE__ */ jsx("button", {
								type: "button",
								className: "ap-icon-btn ap-tap ap-menu__btn",
								onClick: handleOpenOptions,
								"aria-label": "Player options",
								"aria-haspopup": "dialog",
								"aria-expanded": controllerOpen,
								children: /* @__PURE__ */ jsx(DotsIcon, {})
							})
						})
					}),
					isPlaylistMode && /* @__PURE__ */ jsxs("div", {
						className: "ap-track-counter",
						children: [
							"Track ",
							currentIndex + 1,
							" of ",
							queue.length,
							shuffle ? " · Shuffle" : "",
							repeatMode !== "off" ? ` · Repeat ${repeatMode}` : "",
							automix ? " · Automix" : ""
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "ap-track-info",
						role: "group",
						"aria-label": "Track information",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "ap-track-info__title",
							style: titleFont,
							title: formatVersionedTitle(currentTrack.title, currentTrack.versionLabel),
							children: [formatVersionedTitle(currentTrack.title, currentTrack.versionLabel), currentTrack.explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})]
						}), /* @__PURE__ */ jsx("div", {
							className: "ap-track-info__artist",
							style: artistFont,
							title: formatSecondaryLine(currentTrack),
							children: formatSecondaryLine(currentTrack)
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "ap-progress-group",
						role: "group",
						"aria-label": "Playback progress",
						children: [/* @__PURE__ */ jsx(ScrubberCanvasHost, {
							face: "portable",
							density: getScrubberDensity("portable"),
							currentTime,
							duration,
							progress: duration > 0 ? currentTime / duration : 0,
							onSeek: s.seek,
							children: /* @__PURE__ */ jsx(ScrubberCanvasRenderer, {
								currentTime,
								duration,
								onSeek: s.seek,
								children: /* @__PURE__ */ jsx(WaveformAdapter, {
									face: "portable",
									density: getScrubberDensity("portable"),
									waveform: effectiveWaveform,
									currentTime,
									duration,
									buffered,
									disabled: !hasAudio,
									isSeeking,
									onSeek: s.seek,
									onSeekStart: () => s.setSeeking(true),
									onSeekEnd: () => s.setSeeking(false),
									peaks: currentTrack.peaks,
									peaksDuration: currentTrack.waveformDuration,
									getDecodedData: s.getDecodedData,
									url: s.getBackendInfo().active === "html5" ? currentSrc : void 0,
									sourceKey,
									height: waveformHeight,
									waveColor: trackColor,
									progressColor,
									cursorColor: accentColor
								})
							})
						}), /* @__PURE__ */ jsxs("div", {
							className: "ap-times",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ jsx("span", { children: formatTime(currentTime) }), /* @__PURE__ */ jsx("span", { children: formatTime(duration) })]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "ap-transport",
						role: "group",
						"aria-label": "Playback controls",
						children: [
							/* @__PURE__ */ jsx(HoldSkipButton, {
								direction: "previous",
								className: "ap-btn ap-btn--ghost ap-tap",
								disabled: !hasAudio,
								skipDisabled: !isPlaylistMode || !canPreviousTrack,
								seekLabel: "Skip backward 10 seconds",
								skipLabel: "Previous track",
								onSeek: () => s.seekBy(-10),
								onSkip: s.previous,
								children: /* @__PURE__ */ jsx(PrevIcon, {})
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: `ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`,
								onClick: s.toggle,
								disabled: !hasAudio,
								"aria-label": !hasAudio ? "Audio file missing" : showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play",
								children: showPlaySpinner ? /* @__PURE__ */ jsx(SpinnerIcon, {}) : isPlaying ? /* @__PURE__ */ jsx(PauseIcon, {}) : /* @__PURE__ */ jsx(PlayIcon, {})
							}),
							/* @__PURE__ */ jsx(HoldSkipButton, {
								direction: "next",
								className: "ap-btn ap-btn--ghost ap-tap",
								disabled: !hasAudio,
								skipDisabled: !isPlaylistMode || !canNextTrack,
								seekLabel: "Skip forward 10 seconds",
								skipLabel: "Next track",
								onSeek: () => s.seekBy(10),
								onSkip: s.next,
								children: /* @__PURE__ */ jsx(NextIcon, {})
							})
						]
					}),
					showVolume && /* @__PURE__ */ jsx(VolumeControl, {
						volume,
						isMuted,
						disabled: !hasAudio,
						volumeUnsupported,
						onVolumeChange: s.setVolume,
						onToggleMute: s.toggleMute
					}),
					/* @__PURE__ */ jsx(SEICanvasHost, {
						open: surface.isCanvasOpen || surface.isQueueOpen,
						face: "portable",
						supported: surface.canvasSupported,
						activeSurfaceId: surface.mode === "default" ? void 0 : surface.mode,
						children: surface.isQueueOpen ? /* @__PURE__ */ jsx(QueueSurface, {}) : /* @__PURE__ */ jsx(SEICanvasRenderer, {
							currentTime,
							duration,
							lyrics: currentTrack?.lyrics
						})
					}),
					/* @__PURE__ */ jsx(PlayerSurfaceButtons, {
						surface,
						onOpenQueue: () => setQueueOpen(true),
						onOpenFocusedController: handleOpenFocusedController
					}),
					currentTrack.purchaseUrl && /* @__PURE__ */ jsxs("a", {
						className: "ap-wide-btn ap-wide-btn--solid ap-tap",
						href: currentTrack.purchaseUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						children: [/* @__PURE__ */ jsx(HeartIcon, {}), "Support Artist"]
					}),
					isPlaylistMode && showTracklist && /* @__PURE__ */ jsx("div", {
						className: "ap-tracklist ap-anim-in",
						role: "list",
						"aria-label": "Playlist tracks",
						style: { overflowY: "hidden" },
						children: /* @__PURE__ */ jsx(FixedSizeList, {
							height: Math.min(276, queue.length * 52),
							itemCount: queue.length,
							itemSize: 52,
							width: "100%",
							itemData: trackListData,
							children: TrackRow
						})
					})
				]
			})
		]
	}) });
}
var ErrorIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "20",
	height: "20",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "10"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "8",
			x2: "12",
			y2: "12"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "16",
			x2: "12.01",
			y2: "16"
		})
	]
});
var InfoIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "20",
	height: "20",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "10"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "16",
			x2: "12",
			y2: "12"
		}),
		/* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "8",
			x2: "12.01",
			y2: "8"
		})
	]
});
var PlayIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "24",
	height: "24",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("path", { d: "M8 5v14l12-7z" })
});
var PauseIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "24",
	height: "24",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("rect", {
		x: "6",
		y: "4",
		width: "4",
		height: "16"
	}), /* @__PURE__ */ jsx("rect", {
		x: "14",
		y: "4",
		width: "4",
		height: "16"
	})]
});
var SpinnerIcon = () => /* @__PURE__ */ jsxs("svg", {
	className: "ap-spin",
	width: "24",
	height: "24",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "10",
		opacity: "0.25"
	}), /* @__PURE__ */ jsx("path", {
		d: "M12 2a10 10 0 0 1 10 10",
		strokeLinecap: "round"
	})]
});
var PrevIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "14",
	height: "14",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("rect", {
		x: "5",
		y: "4",
		width: "2.5",
		height: "16",
		rx: "0.5"
	}), /* @__PURE__ */ jsx("path", { d: "M20 5v14L9 12z" })]
});
var NextIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "14",
	height: "14",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ jsx("path", { d: "M4 5v14l11-7z" }), /* @__PURE__ */ jsx("rect", {
		x: "16.5",
		y: "4",
		width: "2.5",
		height: "16",
		rx: "0.5"
	})]
});
var HeartIcon = () => /* @__PURE__ */ jsx("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ jsx("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" })
});
var DotsIcon = () => /* @__PURE__ */ jsxs("svg", {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ jsx("circle", {
			cx: "5",
			cy: "12",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "1.8"
		}),
		/* @__PURE__ */ jsx("circle", {
			cx: "19",
			cy: "12",
			r: "1.8"
		})
	]
});
//#endregion
//#region src/audio-player/automix/useAutomix.ts
/**
* Automix Lite: opt-in two-deck crossfade transitions between queued tracks.
*
* The hook deliberately does NOT touch the engine's internals. The engine's
* single <audio> element ("deck A") stays the source of truth; this hook owns
* one detached, never-rendered second element ("deck B") that only exists
* around a transition. The lifecycle is:
*
*   idle ──(near end of A)──▶ preloading: deck B loads the next track and is
*        parked at its silence-trimmed start; silence analysis runs.
*   preloading ──(fade window)──▶ fading: deck B plays while an equal-power
*        ramp swaps the audible balance from A to B over AUTOMIX_FADE_MS.
*   fading ──(ramp done / A ended)──▶ handoff: the host advances its queue
*        exactly like a normal end-of-track advance, the engine reloads the
*        main element with B's URL (HTTP-cached — deck B just fetched it),
*        the hook time-syncs the main element to deck B and, on its first
*        'playing', flips the audio back to the main element and releases the
*        deck. From here on, playback is indistinguishable from normal mode.
*
* Anything unexpected — pause, seek away, manual next/previous, queue edits,
* deck errors, blocked play(), unsupported programmatic volume (iOS Safari) —
* cancels the transition, restores the engine volume, and falls back to the
* existing end-of-track behavior. With `enabled` false the hook is inert.
*/
/** Crossfade duration. Conservative fixed value for V1. */
var AUTOMIX_FADE_MS = 5500;
/** How far before the (trimmed) end of A deck B starts preloading. */
var PRELOAD_LEAD_S = 15;
/** Tracks shorter than this never automix. */
var MIN_TRACK_S = 25;
/** Backward currentTime jump beyond this cancels an active fade. */
var SEEK_BACK_TOLERANCE_S = .75;
/** Give up on a handoff if the main element never reaches 'playing'. */
var HANDOFF_TIMEOUT_MS = 6e3;
/** Re-sync the main element at flip time if it drifted past this. */
var MAX_FLIP_DRIFT_S = .35;
/**
* Page-wide latch: once a browser proves it ignores programmatic element
* volume (iOS Safari), crossfading is impossible. Automix then leaves
* playback entirely to the normal end-of-track behavior.
*/
var fadeUnsupported = false;
var warnedUseAutomixDeprecated = false;
function warnUseAutomixDeprecated() {
	if (warnedUseAutomixDeprecated || typeof console === "undefined") return;
	warnedUseAutomixDeprecated = true;
	console.warn("[AudioPlayer] useAutomix is deprecated. Prefer registering AutomixPlugin through the plugin system.");
}
function useAutomix(options) {
	const { engine, enabled, sourceKey, currentTrack, nextTrack } = options;
	useEffect(() => {
		if (!options.suppressDeprecatedWarning) warnUseAutomixDeprecated();
	}, [options.suppressDeprecatedWarning]);
	const optionsRef = useRef(options);
	optionsRef.current = options;
	const volumeRef = useRef(engine.volume);
	volumeRef.current = engine.volume;
	const phaseRef = useRef("idle");
	const deckRef = useRef(null);
	const deckAbortRef = useRef(null);
	const preloadedKeyRef = useRef(null);
	const fadeIntervalRef = useRef(null);
	const fadeT0Ref = useRef(0);
	const fadeAnchorRef = useRef(0);
	const pendingHandoffRef = useRef(null);
	const handoffAbortRef = useRef(null);
	const handoffTimerRef = useRef(null);
	/** `${sourceKey}->${nextKey}` pairs that errored; never retried. */
	const failedPairRef = useRef(null);
	const prevSourceKeyRef = useRef(sourceKey);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const stopRamp = useCallback(() => {
		if (fadeIntervalRef.current !== null) {
			clearInterval(fadeIntervalRef.current);
			fadeIntervalRef.current = null;
		}
	}, []);
	const releaseDeck = useCallback(() => {
		deckAbortRef.current?.abort();
		deckAbortRef.current = null;
		preloadedKeyRef.current = null;
		const deck = deckRef.current;
		deckRef.current = null;
		if (deck) try {
			deck.pause();
			deck.removeAttribute("src");
			deck.load();
		} catch {}
	}, []);
	const clearHandoff = useCallback(() => {
		pendingHandoffRef.current = null;
		handoffAbortRef.current?.abort();
		handoffAbortRef.current = null;
		if (handoffTimerRef.current !== null) {
			clearTimeout(handoffTimerRef.current);
			handoffTimerRef.current = null;
		}
	}, []);
	/** Abort any in-flight transition and restore normal playback audio. */
	const cancel = useCallback(() => {
		const wasAudible = phaseRef.current === "fading" || phaseRef.current === "handoff";
		stopRamp();
		clearHandoff();
		releaseDeck();
		phaseRef.current = "idle";
		setIsTransitioning(false);
		if (wasAudible) {
			const main = optionsRef.current.engine.audioRef.current;
			if (main) try {
				main.volume = volumeRef.current;
			} catch {}
		}
	}, [
		clearHandoff,
		releaseDeck,
		stopRamp
	]);
	/**
	* The fade is over (ramp completed, or A reached its natural end first).
	* Mark the upcoming source change as ours; optionally trigger it.
	*/
	const finalizeFade = useCallback((advance) => {
		stopRamp();
		pendingHandoffRef.current = preloadedKeyRef.current;
		phaseRef.current = "handoff";
		if (advance) optionsRef.current.requestAdvance();
	}, [stopRamp]);
	const handleTrackEnded = useCallback(() => {
		if (phaseRef.current === "fading") {
			finalizeFade(false);
			return false;
		}
		return phaseRef.current === "handoff";
	}, [finalizeFade]);
	/** Wire deck B for the resolved next track and park it at its trim start. */
	const startPreload = useCallback((next) => {
		if (typeof Audio === "undefined") return;
		const src = getPrimaryTrackSource(next);
		if (!src) return;
		const key = trackKey(next);
		const deck = new Audio();
		deck.preload = "auto";
		try {
			deck.volume = 0;
		} catch {}
		deck.src = src;
		const ac = new AbortController();
		const applyTrimStart = () => {
			const trims = getTrackTrims(next);
			if (!trims || trims.trimStartMs <= 0) return;
			if (deck.paused && deck.readyState >= 1) try {
				deck.currentTime = trims.trimStartMs / 1e3;
			} catch {}
		};
		deck.addEventListener("loadedmetadata", applyTrimStart, { signal: ac.signal });
		deck.addEventListener("error", () => {
			failedPairRef.current = `${optionsRef.current.sourceKey}->${key}`;
			if (phaseRef.current === "fading" || phaseRef.current === "handoff") cancel();
			else if (phaseRef.current === "preloading") {
				releaseDeck();
				phaseRef.current = "idle";
			}
		}, { signal: ac.signal });
		try {
			deck.load();
		} catch {
			return;
		}
		deckAbortRef.current = ac;
		deckRef.current = deck;
		preloadedKeyRef.current = key;
		phaseRef.current = "preloading";
		ensureTrackAnalysis(next).then(applyTrimStart);
	}, [cancel, releaseDeck]);
	/**
	* Equal-power ramp driven by wall-clock setInterval (keeps progressing in
	* throttled background tabs, unlike rAF). Re-reads the user volume every
	* tick so a mid-fade volume change re-targets instead of fighting.
	*/
	const runRamp = useCallback(() => {
		const tick = () => {
			if (phaseRef.current !== "fading") {
				stopRamp();
				return;
			}
			const main = optionsRef.current.engine.audioRef.current;
			const deck = deckRef.current;
			if (!main || !deck) {
				cancel();
				return;
			}
			const t = Math.min(1, (performance.now() - fadeT0Ref.current) / AUTOMIX_FADE_MS);
			const vol = volumeRef.current;
			const mainTarget = Math.cos(t * Math.PI / 2) * vol;
			const deckTarget = Math.sin(t * Math.PI / 2) * vol;
			try {
				main.volume = mainTarget;
				deck.volume = deckTarget;
			} catch {
				fadeUnsupported = true;
				cancel();
				return;
			}
			if (vol > .1 && Math.abs(main.volume - mainTarget) > .05) {
				fadeUnsupported = true;
				cancel();
				return;
			}
			if (t >= 1) {
				stopRamp();
				finalizeFade(true);
			}
		};
		stopRamp();
		fadeIntervalRef.current = setInterval(tick, 33);
	}, [
		cancel,
		finalizeFade,
		stopRamp
	]);
	const startFade = useCallback(() => {
		const opts = optionsRef.current;
		const main = opts.engine.audioRef.current;
		const deck = deckRef.current;
		if (!main || !deck) return;
		if (fadeUnsupported || opts.engine.volumeUnsupported) return;
		if (deck.readyState < 2) return;
		try {
			deck.volume = 0;
			if (deck.volume > .001) {
				fadeUnsupported = true;
				return;
			}
			deck.muted = main.muted;
		} catch {
			fadeUnsupported = true;
			return;
		}
		let playPromise;
		try {
			playPromise = deck.play();
		} catch {
			failedPairRef.current = `${opts.sourceKey}->${preloadedKeyRef.current}`;
			releaseDeck();
			phaseRef.current = "idle";
			return;
		}
		phaseRef.current = "fading";
		setIsTransitioning(true);
		fadeT0Ref.current = performance.now();
		fadeAnchorRef.current = opts.engine.currentTime;
		playPromise.then(() => {
			if (phaseRef.current === "fading") runRamp();
		}).catch(() => {
			if (phaseRef.current === "fading") {
				failedPairRef.current = `${optionsRef.current.sourceKey}->${preloadedKeyRef.current}`;
				cancel();
			}
		});
	}, [
		cancel,
		releaseDeck,
		runRamp
	]);
	/**
	* After our requestAdvance, the host swaps sources and the engine reloads
	* the main element with B's URL. Sync it to deck B's position and flip the
	* audible output back to the main element on its first 'playing'.
	*/
	const attachHandoff = useCallback(() => {
		pendingHandoffRef.current = null;
		const main = optionsRef.current.engine.audioRef.current;
		const deck = deckRef.current;
		if (!main || !deck) {
			cancel();
			return;
		}
		const ac = new AbortController();
		handoffAbortRef.current = ac;
		const syncTime = () => {
			try {
				main.currentTime = deck.currentTime;
			} catch {}
		};
		if (main.readyState >= 1) syncTime();
		else main.addEventListener("loadedmetadata", syncTime, {
			signal: ac.signal,
			once: true
		});
		main.addEventListener("playing", () => {
			try {
				if (Math.abs(deck.currentTime - main.currentTime) > MAX_FLIP_DRIFT_S) syncTime();
				main.volume = volumeRef.current;
			} catch {}
			clearHandoff();
			releaseDeck();
			phaseRef.current = "idle";
			setIsTransitioning(false);
		}, {
			signal: ac.signal,
			once: true
		});
		main.addEventListener("error", cancel, {
			signal: ac.signal,
			once: true
		});
		handoffTimerRef.current = setTimeout(cancel, HANDOFF_TIMEOUT_MS);
	}, [
		cancel,
		clearHandoff,
		releaseDeck
	]);
	useEffect(() => {
		if (prevSourceKeyRef.current === sourceKey) return;
		prevSourceKeyRef.current = sourceKey;
		const expected = pendingHandoffRef.current;
		const current = optionsRef.current.currentTrack;
		if (expected !== null && phaseRef.current === "handoff" && current && trackKey(current) === expected) {
			attachHandoff();
			return;
		}
		if (phaseRef.current !== "idle") cancel();
	}, [
		sourceKey,
		attachHandoff,
		cancel
	]);
	useEffect(() => {
		if (enabled && currentTrack) ensureTrackAnalysis(currentTrack);
	}, [enabled, currentTrack]);
	useEffect(() => {
		if (!enabled && phaseRef.current !== "idle") cancel();
	}, [enabled, cancel]);
	useEffect(() => {
		if (!enabled) return;
		const phase = phaseRef.current;
		const { isPlaying, isSeeking, duration, currentTime, hasError } = engine;
		if (phase === "fading") {
			if (!isPlaying || isSeeking || hasError) {
				cancel();
				return;
			}
			if (currentTime < fadeAnchorRef.current - SEEK_BACK_TOLERANCE_S) {
				cancel();
				return;
			}
			if (!nextTrack || trackKey(nextTrack) !== preloadedKeyRef.current) {
				cancel();
				return;
			}
			return;
		}
		if (phase === "handoff") return;
		if (!currentTrack || !nextTrack) {
			if (phase === "preloading") {
				releaseDeck();
				phaseRef.current = "idle";
			}
			return;
		}
		if (!isPlaying || isSeeking || hasError) return;
		if (duration < MIN_TRACK_S) return;
		if (!engine.audioRef.current) return;
		const nextKey = trackKey(nextTrack);
		if (failedPairRef.current === `${sourceKey}->${nextKey}`) return;
		const trims = getTrackTrims(currentTrack);
		const effectiveEnd = duration - (trims ? trims.trimEndMs / 1e3 : 0);
		const fadeStartAt = Math.max(effectiveEnd - AUTOMIX_FADE_MS / 1e3, duration * .5);
		if (phase === "idle") {
			if (currentTime >= effectiveEnd - PRELOAD_LEAD_S) startPreload(nextTrack);
			return;
		}
		if (preloadedKeyRef.current !== nextKey) {
			releaseDeck();
			phaseRef.current = "idle";
			return;
		}
		if (currentTime >= fadeStartAt) startFade();
	}, [
		enabled,
		engine,
		sourceKey,
		currentTrack,
		nextTrack,
		cancel,
		releaseDeck,
		startFade,
		startPreload
	]);
	useEffect(() => () => cancel(), [cancel]);
	return {
		isTransitioning,
		handleTrackEnded
	};
}
//#endregion
//#region src/audio-player/utils/colorExtraction.ts
/** Convert an RGB triple to a CSS `rgb(...)` string. */
function rgbToCss([r, g, b]) {
	return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
/**
* Relative luminance per WCAG 2.x (0 = black, 1 = white). Used to decide
* adaptive text color and whether a swatch reads as "dark".
*/
function relativeLuminance([r, g, b]) {
	const channel = (v) => {
		const s = v / 255;
		return s <= .03928 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
	};
	return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
}
/** Pick black or white text for best contrast against a background color. */
function contrastText(bg) {
	return relativeLuminance(bg) > .4 ? "#000000" : "#FFFFFF";
}
/** Build a 135° linear gradient between two colors. */
function gradient(a, b) {
	return `linear-gradient(135deg, ${rgbToCss(a)} 0%, ${rgbToCss(b)} 100%)`;
}
/**
* Extract a palette from an image URL.
*
* Resolves `null` (never rejects) when the image cannot be loaded or its pixels
* cannot be read (e.g. a cross-origin host without permissive CORS headers).
*/
function extractPalette(src, options = {}) {
	const sampleSize = options.sampleSize ?? 48;
	const quantStep = options.quantStep ?? 24;
	return new Promise((resolve) => {
		if (!src || typeof document === "undefined") {
			resolve(null);
			return;
		}
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.decoding = "async";
		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = sampleSize;
				canvas.height = sampleSize;
				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				if (!ctx) {
					resolve(null);
					return;
				}
				ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
				const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
				resolve(quantizePixels(data, quantStep));
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = src;
	});
}
/**
* Bucket pixels into coarse color bins and pick the two most prominent vivid
* colors. Exported for unit testing against a hand-built pixel array.
*/
function quantizePixels(data, quantStep = 24) {
	const buckets = /* @__PURE__ */ new Map();
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		if (data[i + 3] < 125) continue;
		const max = Math.max(r, g, b);
		if ((max === 0 ? 0 : (max - Math.min(r, g, b)) / max) < .12 && (max < 40 || max > 225)) continue;
		const key = Math.round(r / quantStep) << 16 | Math.round(g / quantStep) << 8 | Math.round(b / quantStep);
		const bucket = buckets.get(key);
		if (bucket) {
			bucket.count++;
			bucket.sum[0] += r;
			bucket.sum[1] += g;
			bucket.sum[2] += b;
		} else buckets.set(key, {
			count: 1,
			sum: [
				r,
				g,
				b
			]
		});
	}
	if (buckets.size === 0) return null;
	const ranked = [...buckets.values()].sort((a, b) => b.count - a.count).map((bucket) => avg(bucket.sum, bucket.count));
	const primary = ranked[0];
	return {
		primary,
		secondary: pickDistinct(primary, ranked) ?? primary,
		accent: primary,
		isDark: relativeLuminance(primary) < .4
	};
}
function avg(sum, count) {
	return [
		sum[0] / count,
		sum[1] / count,
		sum[2] / count
	];
}
/** First ranked color far enough from `base` in RGB space to read as distinct. */
function pickDistinct(base, ranked) {
	const threshold = 60;
	for (const color of ranked) if (Math.sqrt((color[0] - base[0]) ** 2 + (color[1] - base[1]) ** 2 + (color[2] - base[2]) ** 2) > threshold) return color;
	return null;
}
//#endregion
//#region src/audio-player/plugins/AutoThemePlugin.ts
/** CSS custom properties this plugin writes onto the player root. */
var MANAGED_VARS = [
	"--ap-accent",
	"--ap-progress",
	"--ap-bg",
	"--ap-text",
	"--ap-glow"
];
/**
* Auto Theme: derive the player's palette from the current album art.
*
* While active, this plugin reads the artwork rendered behind the player
* (`.ap-bg-image`, falling back to Media Session artwork), extracts its dominant
* colors via the Canvas API, and writes `--ap-*` CSS variables onto the player
* root — accent, a gradient progress fill, a tinted background, contrast-correct
* text, and an ambient glow. Removing the plugin restores the manual theme: the
* managed vars are cleared on `destroy`, so the root's original inline values
* take over again.
*/
var AutoThemePlugin = class {
	name;
	applyGlow;
	applyGradient;
	extractOptions;
	onPaletteChange;
	context = null;
	currentSrc = null;
	generation = 0;
	constructor(config = {}) {
		const valid = validateConfig(AutoThemePluginConfigSchema, config, "auto-theme");
		this.name = valid.name;
		this.applyGlow = valid.applyGlow;
		this.applyGradient = valid.applyGradient;
		this.extractOptions = {
			sampleSize: valid.sampleSize,
			quantStep: valid.quantStep
		};
		this.onPaletteChange = valid.onPaletteChange;
	}
	init(playerInstance) {
		this.context = playerInstance;
		this.refresh(playerInstance.getCurrentTrack());
	}
	destroy() {
		this.generation++;
		this.clearVars();
		this.currentSrc = null;
		this.context = null;
	}
	onTrackLoad = (track) => {
		this.refresh(track);
	};
	async refresh(track) {
		const root = this.context?.getRootElement();
		if (!root) return;
		const src = this.resolveArtworkSrc(root);
		if (src === this.currentSrc) return;
		this.currentSrc = src;
		const token = ++this.generation;
		if (!src) {
			this.clearVars();
			this.onPaletteChange?.(null, track);
			return;
		}
		const palette = await extractPalette(src, this.extractOptions);
		if (token !== this.generation) return;
		if (!palette) {
			this.clearVars();
			this.onPaletteChange?.(null, track);
			return;
		}
		this.applyPalette(root, palette);
		this.onPaletteChange?.(palette, track);
	}
	/** Read the artwork URL from the rendered backdrop, else Media Session. */
	resolveArtworkSrc(root) {
		const bg = root.querySelector(".ap-bg-image");
		const fromBackdrop = bg ? parseCssUrl(bg.style.backgroundImage) : null;
		if (fromBackdrop) return fromBackdrop;
		if (typeof navigator !== "undefined" && navigator.mediaSession) {
			const artwork = navigator.mediaSession.metadata?.artwork;
			if (artwork && artwork.length > 0) return artwork[0].src;
		}
		return null;
	}
	applyPalette(root, palette) {
		const { primary, secondary, accent, isDark } = palette;
		const surface = isDark ? primary : secondary;
		root.style.setProperty("--ap-accent", rgbToCss(accent));
		root.style.setProperty("--ap-progress", this.applyGradient ? gradient(primary, secondary) : rgbToCss(accent));
		root.style.setProperty("--ap-bg", rgbaTint(surface, .55));
		root.style.setProperty("--ap-text", contrastText(surface));
		if (this.applyGlow) root.style.setProperty("--ap-glow", rgbaTint(accent, .45));
	}
	clearVars() {
		const root = this.context?.getRootElement();
		if (!root) return;
		for (const name of MANAGED_VARS) root.style.removeProperty(name);
	}
};
/** Pull the URL out of a CSS `url("...")` value, if present. */
function parseCssUrl(value) {
	return /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(value)?.[2] || null;
}
function rgbaTint([r, g, b], alpha) {
	return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}
function createAutoThemePlugin(config) {
	return new AutoThemePlugin(config);
}
//#endregion
//#region src/audio-player/plugins/KeyboardShortcutPlugin.ts
/** Space/arrow keyboard controls implemented as a swappable plugin. */
var KeyboardShortcutPlugin = class {
	name;
	handlesKeyboardShortcuts = true;
	scope;
	seekSeconds;
	enableJKL;
	enablePlaylistKeys;
	target = null;
	context = null;
	constructor(config = {}) {
		const valid = validateConfig(KeyboardShortcutPluginConfigSchema, config, "keyboard-shortcuts");
		this.name = valid.name;
		this.scope = valid.scope;
		this.seekSeconds = valid.seekSeconds;
		this.enableJKL = valid.enableJKL;
		this.enablePlaylistKeys = valid.enablePlaylistKeys;
	}
	init(playerInstance) {
		this.context = playerInstance;
		this.target = this.scope === "document" ? typeof document === "undefined" ? null : document : playerInstance.getRootElement();
		this.target?.addEventListener("keydown", this.handleKeyDown);
	}
	destroy() {
		this.target?.removeEventListener("keydown", this.handleKeyDown);
		this.target = null;
		this.context = null;
	}
	handleKeyDown = (nativeEvent) => {
		const event = nativeEvent;
		if (!this.context || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		if (!!event.target?.closest("button, a, input, textarea, select, [role='slider'], [contenteditable='true']")) return;
		const engine = this.context.getEngine();
		const key = event.key.toLowerCase();
		let handled = true;
		if (event.key === " " || event.key === "Spacebar" || this.enableJKL && key === "k") engine.toggle();
		else if (event.key === "ArrowLeft" || this.enableJKL && key === "j") engine.seekBy(-this.seekSeconds);
		else if (event.key === "ArrowRight" || this.enableJKL && key === "l") engine.seekBy(this.seekSeconds);
		else if (this.enablePlaylistKeys && key === "n" && this.context.next) this.context.next();
		else if (this.enablePlaylistKeys && key === "p" && this.context.previous) this.context.previous();
		else handled = false;
		if (handled) event.preventDefault();
	};
};
function createKeyboardShortcutPlugin(config) {
	return new KeyboardShortcutPlugin(config);
}
//#endregion
//#region src/audio-player/plugins/AnalyticsPlugin.ts
/** Small analytics adapter. Provide `send` or `endpoint` to emit events. */
var AnalyticsPlugin = class {
	name;
	endpoint;
	sendCallback;
	includeTimeUpdates;
	timeUpdateIntervalSeconds;
	context = null;
	lastTimeUpdateBucket = -1;
	constructor(config = {}) {
		const valid = validateConfig(AnalyticsPluginConfigSchema, config, "analytics");
		this.name = valid.name;
		this.endpoint = valid.endpoint;
		this.sendCallback = valid.send;
		this.includeTimeUpdates = valid.includeTimeUpdates;
		this.timeUpdateIntervalSeconds = valid.timeUpdateIntervalSeconds;
	}
	init(playerInstance) {
		this.context = playerInstance;
	}
	destroy() {
		this.context = null;
		this.lastTimeUpdateBucket = -1;
	}
	onTrackLoad = (_track) => {
		this.lastTimeUpdateBucket = -1;
		this.emit("track_load");
	};
	onPlay = () => this.emit("play");
	onPause = () => this.emit("pause");
	onStop = () => this.emit("stop");
	onSeek = (position) => this.emit("seek", position);
	onTrackEnded = () => {
		this.emit("track_ended");
	};
	onTimeUpdate = (position) => {
		if (!this.includeTimeUpdates) return;
		const bucket = Math.floor(position / this.timeUpdateIntervalSeconds);
		if (bucket === this.lastTimeUpdateBucket) return;
		this.lastTimeUpdateBucket = bucket;
		this.emit("time_update", position);
	};
	emit(type, overridePosition) {
		if (!this.context || !this.sendCallback && !this.endpoint) return;
		const engine = this.context.getEngine();
		const event = {
			type,
			track: this.context.getCurrentTrack(),
			sourceKey: this.context.getSourceKey(),
			position: overridePosition ?? engine.currentTime,
			duration: engine.duration,
			timestamp: Date.now(),
			plugin: this.name
		};
		if (this.sendCallback) {
			this.sendCallback(event);
			return;
		}
		if (!this.endpoint || typeof window === "undefined") return;
		const body = JSON.stringify(event);
		if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
			const blob = new Blob([body], { type: "application/json" });
			if (navigator.sendBeacon(this.endpoint, blob)) return;
		}
		fetch(this.endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			keepalive: true
		}).catch(() => {});
	}
};
function createAnalyticsPlugin(config) {
	return new AnalyticsPlugin(config);
}
//#endregion
//#region src/audio-player/plugins/LyricsPlugin.ts
/** Syncs LRC-style lyrics with playback and optionally writes the active line to a DOM node. */
var LyricsPlugin = class {
	name;
	configuredLyrics;
	configuredLines;
	onLineChangeCallback;
	target;
	context = null;
	lines = [];
	activeIndex = -1;
	constructor(config = {}) {
		const valid = validateConfig(LyricsPluginConfigSchema, config, "lyrics");
		this.name = valid.name;
		this.configuredLyrics = valid.lyrics;
		this.configuredLines = valid.lines;
		this.onLineChangeCallback = valid.onLineChange;
		this.target = valid.target;
	}
	init(playerInstance) {
		this.context = playerInstance;
		this.loadLyrics(playerInstance.getCurrentTrack());
	}
	destroy() {
		this.context = null;
		this.lines = [];
		this.activeIndex = -1;
		this.writeTarget("");
	}
	onTrackLoad = (track) => {
		this.loadLyrics(track);
	};
	onTimeUpdate = (position) => {
		if (!this.context || this.lines.length === 0) return;
		const engine = this.context.getEngine();
		const index = this.lines.some((line) => line.time > 0) ? this.findTimedLine(position) : this.findApproximateLine(position, engine.duration);
		if (index === this.activeIndex) return;
		this.activeIndex = index;
		const line = index >= 0 ? this.lines[index] : null;
		this.writeTarget(line?.text ?? "");
		this.onLineChangeCallback?.(line, index, this.context.getCurrentTrack());
	};
	loadLyrics(track) {
		const source = this.configuredLines ? this.configuredLines : parseLyrics(this.configuredLyrics ?? track?.lyrics ?? "");
		this.lines = source;
		this.activeIndex = -1;
		this.writeTarget("");
	}
	findTimedLine(position) {
		let active = -1;
		for (let i = 0; i < this.lines.length; i++) if (this.lines[i].time <= position) active = i;
		else break;
		return active;
	}
	findApproximateLine(position, duration) {
		if (duration <= 0) return -1;
		const ratio = Math.max(0, Math.min(.999, position / duration));
		return Math.floor(ratio * this.lines.length);
	}
	writeTarget(text) {
		const target = typeof this.target === "function" ? this.target() : this.target ?? null;
		if (target) target.textContent = text;
	}
};
function parseLyrics(lyrics) {
	const lines = lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	const parsed = [];
	const lrcPattern = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
	for (const line of lines) {
		const match = line.match(lrcPattern);
		if (!match) {
			parsed.push({
				time: 0,
				text: line
			});
			continue;
		}
		const minutes = Number(match[1]);
		const seconds = Number(match[2]);
		const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
		parsed.push({
			time: minutes * 60 + seconds + fraction,
			text: match[4]
		});
	}
	return parsed.sort((a, b) => a.time - b.time);
}
function createLyricsPlugin(config) {
	return new LyricsPlugin(config);
}
//#endregion
//#region src/audio-player/plugins/SleepTimerPlugin.ts
var PRESET_DURATIONS_MS = {
	"15m": 900 * 1e3,
	"30m": 1800 * 1e3,
	"45m": 2700 * 1e3,
	"60m": 3600 * 1e3
};
var OPTIONS = [
	{
		value: "off",
		label: "Sleep timer"
	},
	{
		value: "15m",
		label: "15 min"
	},
	{
		value: "30m",
		label: "30 min"
	},
	{
		value: "45m",
		label: "45 min"
	},
	{
		value: "60m",
		label: "1 hr"
	},
	{
		value: "track-end",
		label: "Until end of track"
	}
];
/** Adds a scoped sleep-timer dropdown and pauses playback when the timer expires. */
var SleepTimerPlugin = class {
	name;
	label;
	renderUi;
	target;
	now;
	context = null;
	preset = "off";
	deadlineMs = null;
	timeoutId = null;
	container = null;
	select = null;
	constructor(config = {}) {
		const valid = validateConfig(SleepTimerPluginConfigSchema, config, "sleep-timer");
		this.name = valid.name;
		this.label = valid.label;
		this.renderUi = valid.renderUi;
		this.target = valid.target;
		this.now = valid.now ?? (() => Date.now());
	}
	init(playerInstance) {
		this.context = playerInstance;
		this.mountUi();
	}
	destroy() {
		this.clearCountdown();
		this.unmountUi();
		this.context = null;
		this.preset = "off";
		this.deadlineMs = null;
	}
	setTimer(preset) {
		this.clearCountdown();
		this.preset = preset;
		this.deadlineMs = null;
		const durationMs = PRESET_DURATIONS_MS[preset];
		if (durationMs !== void 0) {
			this.deadlineMs = this.now() + durationMs;
			this.timeoutId = setTimeout(this.expire, durationMs);
		}
		this.syncSelect();
	}
	getActiveTimer() {
		const remainingMs = this.deadlineMs === null ? null : Math.max(0, this.deadlineMs - this.now());
		return {
			preset: this.preset,
			deadlineMs: this.deadlineMs,
			remainingMs
		};
	}
	onTrackEnded = (_track) => {
		if (this.preset !== "track-end") return;
		this.pauseAndReset();
		return true;
	};
	expire = () => {
		if (this.deadlineMs !== null && this.now() < this.deadlineMs) {
			this.timeoutId = setTimeout(this.expire, this.deadlineMs - this.now());
			return;
		}
		this.pauseAndReset();
	};
	pauseAndReset() {
		this.context?.getEngine().pause();
		this.clearCountdown();
		this.preset = "off";
		this.deadlineMs = null;
		this.syncSelect();
	}
	clearCountdown() {
		if (this.timeoutId === null) return;
		clearTimeout(this.timeoutId);
		this.timeoutId = null;
	}
	mountUi() {
		if (!this.renderUi || typeof document === "undefined") return;
		const target = this.resolveTarget();
		if (!target) return;
		const container = document.createElement("label");
		container.className = "sap-sleep-timer";
		const label = document.createElement("span");
		label.className = "sap-sleep-timer__label";
		label.textContent = this.label;
		const select = document.createElement("select");
		select.className = "sap-sleep-timer__select";
		select.setAttribute("aria-label", "Sleep timer");
		for (const optionConfig of OPTIONS) {
			const option = document.createElement("option");
			option.value = optionConfig.value;
			option.textContent = optionConfig.label;
			select.appendChild(option);
		}
		select.addEventListener("change", this.handleSelectChange);
		container.append(label, select);
		target.appendChild(container);
		this.container = container;
		this.select = select;
		this.syncSelect();
	}
	unmountUi() {
		this.select?.removeEventListener("change", this.handleSelectChange);
		this.container?.remove();
		this.container = null;
		this.select = null;
	}
	resolveTarget() {
		if (typeof this.target === "function") return this.target();
		return this.target ?? this.context?.getRootElement() ?? null;
	}
	syncSelect() {
		if (this.select) this.select.value = this.preset;
	}
	handleSelectChange = (event) => {
		const select = event.currentTarget;
		this.setTimer(select?.value ?? "off");
	};
};
function createSleepTimerPlugin(config) {
	return new SleepTimerPlugin(config);
}
//#endregion
//#region src/audio-player/plugins/WaveformPlugin.ts
/**
* Waveform: a marker plugin that switches a standalone player's scrubber from
* the plain progress bar to the interactive wavesurfer waveform.
*
* It owns no playback behavior — it sets `providesWaveform`, which the
* `AudioPlayer` detects to render the waveform (gated by the player's "Show
* Waveform" toggle). Its only side effect is an optional best-effort peaks
* pre-warm via `computePeaksFromUrl`, so removing it cannot disturb playback.
*/
var WaveformPlugin = class {
	name;
	providesWaveform = true;
	prewarmPeaks;
	prewarmed = null;
	constructor(config = {}) {
		const valid = validateConfig(WaveformPluginConfigSchema, config, "waveform");
		this.name = valid.name;
		this.prewarmPeaks = valid.prewarmPeaks;
	}
	init(playerInstance) {
		this.warm(playerInstance.getCurrentTrack());
	}
	destroy() {
		this.prewarmed = null;
	}
	onTrackLoad(track) {
		this.warm(track);
	}
	/** Best-effort peaks pre-warm; never throws into the host. */
	warm(track) {
		if (!this.prewarmPeaks) return;
		const url = getPrimaryTrackSource(track);
		if (!url || track?.peaks || this.prewarmed === url) return;
		this.prewarmed = url;
		computePeaksFromUrl(url).catch(() => {});
	}
};
/** Factory mirroring the other registry plugins (fresh instance per install). */
function createWaveformPlugin(config = {}) {
	return new WaveformPlugin(config);
}
//#endregion
//#region src/audio-player/cues/cueRuntime.ts
var CueRuntime = class {
	context;
	firedCueIds = /* @__PURE__ */ new Set();
	timeCues;
	cueMap = /* @__PURE__ */ new Map();
	triggerMap = /* @__PURE__ */ new Map();
	lastTime = 0;
	activeSprites = /* @__PURE__ */ new Map();
	constructor(context, manifest) {
		this.context = context;
		this.timeCues = manifest.cues.filter((c) => c.trigger.kind === "time").sort((a, b) => {
			return (a.trigger.kind === "time" ? a.trigger.at : 0) - (b.trigger.kind === "time" ? b.trigger.at : 0);
		});
		for (const cue of manifest.cues) {
			if (cue.id) this.cueMap.set(cue.id, cue);
			if (cue.trigger.kind !== "time") {
				const triggerKey = `${cue.trigger.kind}:${cue.trigger.value}`;
				if (!this.triggerMap.has(triggerKey)) this.triggerMap.set(triggerKey, []);
				this.triggerMap.get(triggerKey).push(cue);
			}
		}
		if (manifest.assets?.spritePacks && this.context.sounds) {
			const packToLoad = manifest.assets.spritePacks["default"] || Object.values(manifest.assets.spritePacks)[0];
			if (packToLoad) this.context.sounds.loadSpritePack(packToLoad).catch((e) => {
				console.warn("SAP Cues: Failed to load sprite pack", e);
			});
		}
	}
	reset() {
		this.firedCueIds.clear();
		this.lastTime = 0;
		if (this.context.sounds) for (const ids of this.activeSprites.values()) for (const id of ids) this.context.sounds.stopSprite(id);
		this.activeSprites.clear();
	}
	handleTimeUpdate(currentTime, isSeeking = false) {
		for (const cue of this.timeCues) {
			if (cue.trigger.kind !== "time") continue;
			const hasFired = this.firedCueIds.has(cue.id);
			const triggerTime = cue.trigger.at;
			if (isSeeking && currentTime < triggerTime) {
				if (cue.replayable) this.firedCueIds.delete(cue.id);
				continue;
			}
			if (!hasFired && currentTime >= triggerTime) {
				if (isSeeking && !cue.fireOnSeek) {
					this.firedCueIds.add(cue.id);
					continue;
				}
				if (isSeeking || this.lastTime <= triggerTime && currentTime >= triggerTime) {
					this.firedCueIds.add(cue.id);
					this.executeActions(cue.actions);
				}
			}
		}
		this.lastTime = currentTime;
	}
	/** Manually execute a cue by its ID, ignoring time checks. */
	executeCueById(id) {
		const cue = this.cueMap.get(id);
		if (cue) this.executeActions(cue.actions);
	}
	/** Execute any cues matching the given trigger kind and value. */
	executeCueByTrigger(kind, value) {
		const triggerKey = `${kind}:${value}`;
		const cues = this.triggerMap.get(triggerKey);
		if (cues) for (const cue of cues) this.executeActions(cue.actions);
	}
	executeActions(actions) {
		for (const action of actions) try {
			switch (action.command) {
				case "sprite.play":
					if (this.context.sounds) {
						const id = this.context.sounds.playSprite(action.clip, {
							loop: action.loop,
							volume: action.volume
						});
						if (id) {
							const key = `${action.pack || "default"}:${action.clip}`;
							if (!this.activeSprites.has(key)) this.activeSprites.set(key, []);
							this.activeSprites.get(key).push(id);
						}
					}
					break;
				case "sprite.stop":
					if (this.context.sounds) if (action.clip) {
						const key = `${action.pack || "default"}:${action.clip}`;
						const ids = this.activeSprites.get(key);
						if (ids) {
							for (const id of ids) this.context.sounds.stopSprite(id);
							this.activeSprites.delete(key);
						}
					} else {
						for (const ids of this.activeSprites.values()) for (const id of ids) this.context.sounds.stopSprite(id);
						this.activeSprites.clear();
					}
					break;
				case "sprite.fade":
					if (this.context.sounds) {
						const key = `${action.pack || "default"}:${action.clip}`;
						const ids = this.activeSprites.get(key);
						if (ids) for (const id of ids) this.context.sounds.fadeSprite(id, action.volume, action.durationMs);
					}
					break;
				case "player.seek":
					this.context.getEngine().seek(action.time);
					break;
				case "player.pause":
					this.context.getEngine().pause();
					break;
				case "event.emit":
					(this.context.getRootElement() || window).dispatchEvent(new CustomEvent(action.eventName, {
						detail: action.detail,
						bubbles: true
					}));
					break;
				case "ambience.crossfade":
				case "duck.set":
				case "volume.fadeNarration":
				case "layer.set":
				case "spatial.pan":
					(this.context.getRootElement() || window).dispatchEvent(new CustomEvent("sap-narrative-cue", {
						detail: action,
						bubbles: true
					}));
					break;
			}
		} catch (e) {
			console.error("SAP Cues: Failed to execute cue action", action, e);
		}
	}
};
var cueTriggerSchema = union([object({
	kind: literal("time"),
	at: number()
}), object({
	kind: _enum([
		"scene",
		"paragraph",
		"chapter",
		"metadata",
		"tension",
		"powerShift",
		"emotion",
		"relationshipShift",
		"danger",
		"element",
		"signature",
		"intensity"
	]),
	value: union([string(), number()])
})]);
var cueActionSchema = discriminatedUnion("command", [
	object({
		command: literal("sprite.play"),
		pack: string(),
		clip: string(),
		loop: boolean().optional(),
		fadeInMs: number().optional(),
		volume: number().optional()
	}),
	object({
		command: literal("sprite.stop"),
		pack: string().optional(),
		clip: string().optional(),
		fadeOutMs: number().optional()
	}),
	object({
		command: literal("sprite.fade"),
		pack: string(),
		clip: string(),
		volume: number(),
		durationMs: number()
	}),
	object({
		command: literal("ambience.crossfade"),
		profile: string(),
		durationMs: number().optional()
	}),
	object({
		command: literal("duck.set"),
		amount: number()
	}),
	object({
		command: literal("volume.fadeNarration"),
		volume: number(),
		durationMs: number()
	}),
	object({
		command: literal("player.seek"),
		time: number()
	}),
	object({ command: literal("player.pause") }),
	object({
		command: literal("event.emit"),
		eventName: string(),
		detail: unknown().optional()
	}),
	object({
		command: literal("layer.set"),
		layer: string(),
		state: union([string(), number()])
	}),
	object({
		command: literal("spatial.pan"),
		pack: string().optional(),
		clip: string().optional(),
		x: number(),
		y: number(),
		z: number(),
		durationMs: number().optional()
	})
]);
var cueEventSchema = object({
	id: string().optional().transform((val) => val || `cue-${Math.random().toString(36).slice(2, 9)}`),
	trigger: cueTriggerSchema,
	actions: array(any().transform((val) => {
		const parsed = cueActionSchema.safeParse(val);
		if (!parsed.success) {
			console.warn("SAP Cues: Ignoring invalid action:", parsed.error);
			return null;
		}
		return parsed.data;
	})).transform((actions) => actions.filter((a) => a !== null)),
	replayable: boolean().optional(),
	fireOnSeek: boolean().optional()
});
var audioSpriteClipSchema = object({
	offset: number(),
	duration: number(),
	volume: number().optional(),
	loop: boolean().optional()
});
var audioSpriteManifestSchema = object({
	src: string(),
	clips: record(string(), audioSpriteClipSchema)
});
var cueManifestSchema = object({
	version: literal("sap-cues/1"),
	id: string().optional(),
	metadata: record(string(), unknown()).optional(),
	assets: object({ spritePacks: record(string(), audioSpriteManifestSchema).optional() }).optional(),
	cues: array(any().transform((val, _ctx) => {
		const parsed = cueEventSchema.safeParse(val);
		if (!parsed.success) {
			console.warn("SAP Cues: Ignoring invalid cue:", parsed.error);
			return null;
		}
		return parsed.data;
	})).transform((cues) => cues.filter((c) => c !== null))
});
function validateCueManifest(json) {
	try {
		const parsed = cueManifestSchema.safeParse(json);
		if (parsed.success) return parsed.data;
		console.warn("SAP Cues: Manifest validation failed entirely.", parsed.error);
		return null;
	} catch (e) {
		console.error("SAP Cues: Validation threw an exception", e);
		return null;
	}
}
//#endregion
//#region src/audio-player/cues/CueManifestPlugin.ts
var CueManifestPlugin = class {
	name = "cueManifest";
	context = null;
	runtime = null;
	abortController = null;
	init(context) {
		this.context = context;
		this.handleDispatchCue = this.handleDispatchCue.bind(this);
		(this.context.getRootElement() || window).addEventListener("sap-dispatch-cue", this.handleDispatchCue);
	}
	destroy() {
		if (this.context) (this.context.getRootElement() || window).removeEventListener("sap-dispatch-cue", this.handleDispatchCue);
		this.cleanup();
		this.context = null;
	}
	handleDispatchCue(e) {
		if (!this.runtime) return;
		const detail = e.detail;
		if (!detail) return;
		if (detail.id) this.runtime.executeCueById(detail.id);
		else if (detail.kind && detail.value !== void 0) this.runtime.executeCueByTrigger(detail.kind, detail.value);
	}
	cleanup() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		if (this.runtime) {
			this.runtime.reset();
			this.runtime = null;
		}
	}
	onTrackLoad(track) {
		this.cleanup();
		if (!track || !this.context) return;
		if (track.cueManifest) {
			const manifest = validateCueManifest(track.cueManifest);
			if (manifest) this.runtime = new CueRuntime(this.context, manifest);
		} else if (track.cueManifestUrl) {
			this.abortController = new AbortController();
			fetch(track.cueManifestUrl, { signal: this.abortController.signal }).then((res) => {
				if (!res.ok) throw new Error(`Failed to fetch cue manifest: ${res.status} ${res.statusText}`);
				return res.json();
			}).then((data) => {
				const manifest = validateCueManifest(data);
				if (manifest && this.context) this.runtime = new CueRuntime(this.context, manifest);
			}).catch((e) => {
				if (e.name !== "AbortError") console.warn("Failed to fetch cue manifest from URL:", e);
			});
		}
	}
	onTimeUpdate(position) {
		if (this.runtime && this.context) this.runtime.handleTimeUpdate(position, false);
	}
	onSeek(position) {
		if (this.runtime) this.runtime.handleTimeUpdate(position, true);
	}
	onStop() {
		this.cleanup();
	}
};
function createCueManifestPlugin() {
	return new CueManifestPlugin();
}
//#endregion
//#region src/audio-player/cues/useNarrativeCueController.ts
/**
* A host-facing React hook that acts as the bridge between generic Cue Manifest
* events and the SAP narrative audio engine.
*/
function useNarrativeCueController(options = {}) {
	const { eventTarget } = options;
	const [state, setState] = useState({
		sceneMood: void 0,
		ambientProfile: void 0,
		fxClip: void 0,
		fxLoop: false,
		duckAmount: .6,
		intensity: 1,
		chapterId: void 0
	});
	useEffect(() => {
		const target = eventTarget || (typeof window !== "undefined" ? window : null);
		if (!target) return;
		const handler = (e) => {
			const action = e.detail;
			if (!action || !action.command) return;
			setState((s) => {
				const next = { ...s };
				switch (action.command) {
					case "ambience.crossfade":
						next.ambientProfile = action.profile;
						break;
					case "duck.set":
						next.duckAmount = action.amount;
						break;
				}
				return next;
			});
		};
		target.addEventListener("sap-narrative-cue", handler);
		return () => target.removeEventListener("sap-narrative-cue", handler);
	}, [eventTarget]);
	const dispatchCueEvent = useCallback((trigger) => {
		const target = eventTarget || (typeof window !== "undefined" ? window : null);
		if (!target) return;
		target.dispatchEvent(new CustomEvent("sap-dispatch-cue", {
			detail: trigger,
			bubbles: true
		}));
	}, [eventTarget]);
	return {
		/** Options to spread into `useNarrativeAudio`. */
		narrativeOptions: state,
		dispatchCueEvent,
		enterScene: useCallback((sceneId) => {
			dispatchCueEvent({
				kind: "scene",
				value: sceneId
			});
		}, [dispatchCueEvent]),
		enterParagraph: useCallback((paragraphId) => {
			dispatchCueEvent({
				kind: "paragraph",
				value: paragraphId
			});
		}, [dispatchCueEvent]),
		enterChapter: useCallback((chapterId) => {
			dispatchCueEvent({
				kind: "chapter",
				value: chapterId
			});
		}, [dispatchCueEvent]),
		applyMetadataSignature: useCallback((signature) => {
			dispatchCueEvent({
				kind: "signature",
				value: signature
			});
		}, [dispatchCueEvent])
	};
}
//#endregion
//#region src/audio-player/utils/checkCodecSupport.ts
/**
* Check if the browser supports a given audio MIME type.
* Returns false in SSR/non-browser environments.
*/
function checkCodecSupport(mimeType) {
	if (typeof window === "undefined" || typeof document === "undefined") return false;
	const a = document.createElement("audio");
	if (!a.canPlayType) return false;
	const result = a.canPlayType(mimeType);
	return result === "probably" || result === "maybe";
}
//#endregion
//#region src/audio-player/utils/validateTrackSource.ts
/**
* Validates an audio track URL by attempting a HEAD request.
* Returns information about accessibility, CORS status, and optionally
* checks codec support if the MIME type can be determined.
*/
async function validateTrackSource(url, options = {}) {
	const { timeoutMs = 5e3, checkCodec = true } = options;
	let response;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		response = await fetch(url, {
			method: "HEAD",
			mode: "cors",
			signal: controller.signal
		});
		clearTimeout(timeoutId);
	} catch (error) {
		clearTimeout(timeoutId);
		if (error.name === "AbortError") return {
			ok: false,
			accessible: false,
			corsEnabled: false,
			error: "Request timed out"
		};
		try {
			const fallbackController = new AbortController();
			const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), timeoutMs);
			response = await fetch(url, {
				method: "HEAD",
				mode: "no-cors",
				signal: fallbackController.signal
			});
			clearTimeout(fallbackTimeoutId);
			if (response.type === "opaque") return {
				ok: true,
				accessible: true,
				corsEnabled: false
			};
		} catch (fallbackError) {
			return {
				ok: false,
				accessible: false,
				corsEnabled: false,
				error: fallbackError.message || "Network error"
			};
		}
	}
	if (!response.ok && response.type !== "opaque") return {
		ok: false,
		accessible: false,
		corsEnabled: true,
		error: `HTTP ${response.status} ${response.statusText}`
	};
	const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || void 0;
	let codecSupported = void 0;
	if (mimeType && checkCodec) codecSupported = checkCodecSupport(mimeType);
	return {
		ok: codecSupported === false ? false : true,
		accessible: true,
		corsEnabled: true,
		mimeType,
		codecSupported
	};
}
//#endregion
//#region src/audio-player/components/workspace/VisualLyricsWorkspace.tsx
function VisualLyricsWorkspace({ lyrics }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "sap-ctl__workspace-empty",
		children: [/* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-lead",
			children: "Lyrics"
		}), lyrics ? /* @__PURE__ */ jsx("div", {
			className: "sap-ctl__lyrics",
			children: lyrics
		}) : /* @__PURE__ */ jsx("p", {
			className: "sap-ctl__workspace-sub",
			children: "Lyrics display and sync settings will appear here."
		})]
	});
}
//#endregion
//#region src/audio-player/headless/composeEventHandlers.ts
/** True when a previous handler asked for the rest of the chain to be skipped. */
function isSAPDefaultPrevented(event) {
	if (!event || typeof event !== "object") return false;
	const e = event;
	return e.defaultPrevented === true || e.sapPreventDefault === true || e.nativeEvent?.sapPreventDefault === true;
}
/**
* Merge any number of optional event handlers into one. Handlers run in
* order, nullish entries are skipped, and the chain stops as soon as
* `isSAPDefaultPrevented(event)` reports true.
*/
function composeEventHandlers(...handlers) {
	return (event) => {
		for (const handler of handlers) {
			if (!handler) continue;
			if (isSAPDefaultPrevented(event)) return;
			handler(event);
		}
	};
}
//#endregion
//#region src/audio-player/headless/mergeRefs.ts
/**
* Merge callback refs and object refs into a single callback ref, so a prop
* getter can attach SAP's internal ref without losing the caller's:
*
*     <audio {...getAudioElementProps({ ref: myRef })} />
*
* Nullish refs are skipped.
*/
function mergeRefs(...refs) {
	return (node) => {
		for (const ref of refs) {
			if (!ref) continue;
			if (typeof ref === "function") ref(node);
			else ref.current = node;
		}
	};
}
//#endregion
//#region src/audio-player/headless/useSAPPropGetters.ts
/** True when the engine is a `SessionEngine` (has queue navigation). */
function isSessionEngine(engine) {
	const candidate = engine;
	return typeof candidate.next === "function" && typeof candidate.previous === "function";
}
/**
* Downshift-style prop getters over an EXISTING SAP engine. This is an
* adapter, not an engine creator: pass it the engine you already have —
* `useAudioPlayer(...)` for a standalone player, or `useAudioSession()` so a
* custom skin shares the one global `<audio>` source with every other skin.
*
* Each getter returns spreadable, unstyled props: correct accessibility
* attributes, disabled handling, Enter/Space activation for non-`<button>`
* hosts, and caller props preserved (caller event handlers run first; set
* `event.sapPreventDefault = true` or call `event.preventDefault()` to skip
* SAP's internal handler).
*
* Queue getters (`getNextButtonProps` / `getPreviousButtonProps`) are only
* active on a `SessionEngine`; on a plain `AudioPlayerEngine` they render
* disabled and no-op safely.
*/
function useSAPPropGetters(engine, options = {}) {
	const { seekStep = 10 } = options;
	return useMemo(() => {
		const session = isSessionEngine(engine) ? engine : null;
		const noAudio = !engine.hasAudio;
		const keyboardActivation = (run) => (event) => {
			const tag = event.currentTarget.tagName;
			if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			run();
		};
		const buttonProps = (sap, user = {}) => {
			const { onClick, onKeyDown, disabled: userDisabled, ...rest } = user;
			const isDisabled = userDisabled ?? sap.disabled;
			const run = () => {
				if (!isDisabled) sap.action();
			};
			return {
				type: "button",
				"aria-label": sap.label,
				"aria-pressed": sap.pressed,
				disabled: isDisabled || void 0,
				"aria-disabled": isDisabled || void 0,
				...rest,
				onClick: composeEventHandlers(onClick, run),
				onKeyDown: composeEventHandlers(onKeyDown, keyboardActivation(run))
			};
		};
		const getPlayButtonProps = (user = {}) => buttonProps({
			label: engine.isPlaying ? "Pause" : "Play",
			pressed: engine.isPlaying,
			action: () => engine.toggle(),
			disabled: noAudio
		}, user);
		const getMuteButtonProps = (user = {}) => buttonProps({
			label: engine.isMuted ? "Unmute" : "Mute",
			pressed: engine.isMuted,
			action: () => engine.toggleMute(),
			disabled: false
		}, user);
		const getNextButtonProps = (user = {}) => buttonProps({
			label: "Next track",
			action: () => session?.next(),
			disabled: !session || !session.canNext
		}, user);
		const getPreviousButtonProps = (user = {}) => buttonProps({
			label: "Previous track",
			action: () => session?.previous(),
			disabled: !session || !session.canPrevious
		}, user);
		const getSeekForwardButtonProps = (user = {}) => buttonProps({
			label: `Seek forward ${seekStep} seconds`,
			action: () => engine.seekBy(seekStep),
			disabled: noAudio
		}, user);
		const getSeekBackwardButtonProps = (user = {}) => buttonProps({
			label: `Seek backward ${seekStep} seconds`,
			action: () => engine.seekBy(-seekStep),
			disabled: noAudio
		}, user);
		/**
		* Simple slider fallback for fully custom skins. For advanced
		* scrubbing (pointer capture, buffered ranges) keep using the
		* exported `ProgressBar` component.
		*/
		const getProgressBarProps = (user = {}) => {
			const { onKeyDown, ...rest } = user;
			const duration = engine.duration || 0;
			const now = duration > 0 ? Math.min(Math.max(engine.currentTime, 0), duration) : 0;
			const handleKeyDown = (event) => {
				if (noAudio) return;
				switch (event.key) {
					case "ArrowRight":
					case "ArrowUp":
						event.preventDefault();
						engine.seekBy(seekStep);
						break;
					case "ArrowLeft":
					case "ArrowDown":
						event.preventDefault();
						engine.seekBy(-seekStep);
						break;
					case "Home":
						event.preventDefault();
						engine.seek(0);
						break;
					case "End":
						if (duration > 0) {
							event.preventDefault();
							engine.seek(duration);
						}
						break;
				}
			};
			return {
				role: "slider",
				tabIndex: noAudio ? -1 : 0,
				"aria-label": "Seek slider",
				"aria-valuemin": 0,
				"aria-valuemax": Math.max(0, Math.floor(duration)),
				"aria-valuenow": Math.floor(now),
				"aria-valuetext": `${formatTime(now)} of ${formatTime(duration)}`,
				"aria-disabled": noAudio || void 0,
				...rest,
				onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown)
			};
		};
		/**
		* Props for a host-rendered hidden `<audio>` element. The engine's
		* internal ref stays attached (merged with the caller's), keeping the
		* engine the single source of truth — no direct backend mutation is
		* exposed. Not needed under `AudioSessionProvider`, which already
		* renders the one shared element.
		*/
		const getAudioElementProps = (user = {}) => {
			const { ref, ...rest } = user;
			return {
				...rest,
				src: engine.hasAudio ? engine.currentSrc : void 0,
				ref: mergeRefs(engine.audioRef, ref)
			};
		};
		return {
			getPlayButtonProps,
			getMuteButtonProps,
			getNextButtonProps,
			getPreviousButtonProps,
			getSeekForwardButtonProps,
			getSeekBackwardButtonProps,
			getProgressBarProps,
			getAudioElementProps
		};
	}, [engine, seekStep]);
}
//#endregion
//#region src/audio-player/session/sessionSerializer.ts
/**
* Serializes the current session state into a plain object suitable for
* localStorage or sharing.
*/
function serializeSession(session) {
	return {
		queue: [...session.queue],
		currentIndex: session.currentIndex,
		currentTime: session.currentTime,
		shuffle: session.shuffle,
		repeatMode: session.repeatMode,
		timestamp: Date.now()
	};
}
function isValidTrack(track) {
	return track && typeof track === "object" && typeof track.title === "string" && typeof track.artist === "string" && (typeof track.audioFile === "string" || Array.isArray(track.sources));
}
function isValidRepeatMode(mode) {
	return mode === "off" || mode === "all" || mode === "one";
}
/**
* Deserializes a session state, validating its structure.
* Returns the validated session, or null if the data is invalid or expired.
*/
function deserializeSession(data, options) {
	if (!data || typeof data !== "object") return null;
	const session = data;
	if (options?.maxAgeMs !== void 0 && typeof session.timestamp === "number" && Date.now() - session.timestamp > options.maxAgeMs) return null;
	if (!Array.isArray(session.queue)) return null;
	const validQueue = [];
	for (const item of session.queue) if (isValidTrack(item)) {
		const track = { ...item };
		if (options?.urlTransformer) {
			if (track.audioFile) track.audioFile = options.urlTransformer(track.audioFile);
			if (track.fallbackSources) track.fallbackSources = track.fallbackSources.map(options.urlTransformer);
			if (track.sources) track.sources = track.sources.map((s) => ({
				...s,
				url: options.urlTransformer(s.url)
			}));
		}
		validQueue.push(track);
	}
	if (validQueue.length === 0 && session.queue.length > 0) return null;
	return {
		queue: validQueue,
		currentIndex: typeof session.currentIndex === "number" ? session.currentIndex : -1,
		currentTime: typeof session.currentTime === "number" ? session.currentTime : 0,
		shuffle: typeof session.shuffle === "boolean" ? session.shuffle : false,
		repeatMode: isValidRepeatMode(session.repeatMode) ? session.repeatMode : "off",
		timestamp: typeof session.timestamp === "number" ? session.timestamp : Date.now()
	};
}
//#endregion
//#region src/audio-player/surfaces/PlayerHero.tsx
/**
* The hero identity block. It renders the full hero by default and a compact
* identity header when `collapsed` — the SAME DOM node with a `data-collapsed`
* flag, so the transition animates and nothing navigates away (no route/modal/
* tab). Faces that don't support hero collapse always receive `collapsed={false}`.
*
* The title shows an optional version qualifier and explicit badge and can
* marquee when it overflows; the artist line composes featured artists + album.
*/
function PlayerHero({ face, collapsed, title, artist, art, className, album, featuredArtists, versionLabel, explicit, releaseTitle, subtitle, marquee = false, titleFont, artistFont }) {
	const fullTitle = formatVersionedTitle(title, versionLabel);
	const secondary = formatSecondaryLine({
		artist,
		featuredArtists,
		albumTitle: album,
		subtitle
	});
	const release = releaseTitle?.trim();
	const useMarquee = marquee && !collapsed;
	const titleContent = /* @__PURE__ */ jsxs(Fragment, { children: [fullTitle, explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})] });
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-hero${className ? ` ${className}` : ""}`,
		"data-collapsed": collapsed ? "true" : "false",
		"data-face": face,
		role: "group",
		"aria-label": "Track information",
		children: [art && /* @__PURE__ */ jsx("div", {
			className: "ap-hero__art",
			children: art
		}), /* @__PURE__ */ jsxs("div", {
			className: "ap-hero__text",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "ap-hero__title",
					title: fullTitle,
					dir: "auto",
					style: titleFont,
					children: useMarquee ? /* @__PURE__ */ jsx(TextMarquee, {
						className: "ap-hero__marquee",
						children: titleContent
					}) : titleContent
				}),
				/* @__PURE__ */ jsx("div", {
					className: "ap-hero__artist",
					title: secondary,
					dir: "auto",
					style: artistFont,
					children: secondary
				}),
				!collapsed && release && release !== album?.trim() && /* @__PURE__ */ jsx("div", {
					className: "ap-hero__release",
					title: release,
					dir: "auto",
					children: release
				})
			]
		})]
	});
}
//#endregion
//#region src/audio-player/skins/FullCardPlayer.tsx
/**
* The rich "now playing" card, driven by the global session. Keeps the core
* transport visible (prev / back 10 / play / fwd 10 / next); shuffle, repeat,
* automix, queue, info, and share live in the SAP Controller behind the "…"
* button. This skin is the designated owner of the autoplay-blocked prompt so
* users don't see five simultaneous prompts.
*
* Capability-driven (`PLAYER_FACE_CAPABILITIES.fullCard`): the fully-wired face.
* It hosts the SEICanvas (`supportsSEICanvas`), the ScrubberCanvas
* (`supportsScrubberCanvas`), and the contextual radial menu
* (`supportsContextualActions`, rendered via `PlayerSurfaceButtons`) — none of
* these are hard-coded here; each render zone follows the model. The SAP
* three-dot controller is always present for deep actions independent of those
* capabilities.
*/
function FullCardPlayer({ showVolume = defaultShowVolume(), backgroundMedia, backgroundImage, blurSize = 20, darkenAmount = 0, artMedia, art, titleFont, artistFont, className, style, ...theme }) {
	const s = useAudioSession();
	const surface = usePlayerSurface("fullCard");
	const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
	const [controllerOpen, setControllerOpen] = useState(false);
	const [controllerRoute, setControllerRoute] = useState("options");
	const { currentTrack, currentIndex, queue, isPlaying, isBuffering, currentTime, duration, buffered, isSeeking, volume, isMuted, volumeUnsupported, hasAudio, hasError, errorMessage, autoplayBlocked, shuffle, repeatMode, automix, canNext, canPrevious } = s;
	const themeVars = buildThemeVars(theme);
	const backdrop = resolveMedia({
		media: backgroundMedia,
		legacyImage: backgroundImage
	});
	const heroArt = resolveMedia({
		media: artMedia,
		legacyCss: art
	});
	const heroArtNode = heroArt.media?.kind === "video" ? /* @__PURE__ */ jsx("video", {
		className: "ap-fc__hero-art",
		src: heroArt.media.src,
		poster: heroArt.media.poster,
		ref: ensureMuted,
		muted: true,
		autoPlay: true,
		loop: true,
		playsInline: true,
		"aria-hidden": "true"
	}) : heroArt.cssBackground ? /* @__PURE__ */ jsx("div", {
		className: "ap-fc__hero-art",
		style: { backgroundImage: heroArt.cssBackground },
		"aria-hidden": "true"
	}) : void 0;
	const isEmpty = queue.length === 0;
	const showPlaySpinner = isBuffering;
	const mediaSessionArtworkSrc = currentTrack?.artwork ?? artMedia?.src ?? (art ? extractUrlFromCss(art) : null) ?? backgroundMedia?.src ?? backgroundImage?.src;
	const artwork = useMemo(() => mediaSessionArtworkSrc ? buildMediaSessionArtwork(mediaSessionArtworkSrc) : [], [mediaSessionArtworkSrc]);
	useMediaSessionObserver(s, {
		title: currentTrack?.title ?? "",
		artist: currentTrack?.artist ?? "",
		album: currentTrack?.albumTitle ?? "",
		artwork,
		sourceKey: currentTrack ? `${currentIndex}:${trackKey(currentTrack)}:${trackSourcesSignature(currentTrack)}` : "empty",
		onNext: canNext ? s.next : void 0,
		onPrevious: canPrevious ? s.previous : void 0
	});
	const handleOpenQueue = useCallback(() => setQueueDrawerOpen(true), []);
	const handleCloseQueue = useCallback(() => setQueueDrawerOpen(false), []);
	const { share, copied: shareCopied, nativeShare } = useShareTrack(currentTrack?.title ?? "", currentTrack?.artist ?? "");
	const handleShareClick = useCallback(() => {
		if (nativeShare) setControllerOpen(false);
		share();
	}, [nativeShare, share]);
	const handleOpenFocusedController = useCallback((route) => {
		setControllerRoute(route);
		setControllerOpen(true);
	}, []);
	const handleCloseController = useCallback(() => {
		setControllerOpen(false);
		setControllerRoute("options");
	}, []);
	const handleOpenOptions = useCallback(() => {
		setControllerRoute("options");
		setControllerOpen(true);
	}, []);
	return /* @__PURE__ */ jsx(VisualSlotsProvider, { children: /* @__PURE__ */ jsxs("div", {
		className: `ap-fc ap-glass-surface${className ? ` ${className}` : ""}`,
		style: {
			...themeVars,
			"--ap-blur": `${blurSize}px`,
			...style
		},
		role: "region",
		"aria-label": "Now playing",
		children: [
			/* @__PURE__ */ jsx(BackgroundMedia, {
				media: backdrop.media,
				cssBackground: backdrop.cssBackground,
				darkenAmount,
				className: "ap-fc__bg"
			}),
			/* @__PURE__ */ jsx(QueueDrawer, {
				queue,
				currentIndex,
				isPlaying,
				open: queueDrawerOpen,
				onClose: handleCloseQueue,
				onPlayTrack: s.playTrack,
				onReorder: s.moveQueueItem,
				onRemove: s.removeFromQueue
			}),
			/* @__PURE__ */ jsx(SAPController, {
				open: controllerOpen,
				onClose: handleCloseController,
				route: controllerRoute,
				playback: {
					shuffle,
					onToggleShuffle: s.toggleShuffle,
					repeatMode,
					onCycleRepeat: s.cycleRepeat,
					automix,
					onToggleAutomix: s.toggleAutomix
				},
				queue: isEmpty ? void 0 : {
					count: queue.length,
					onOpenQueue: handleOpenQueue
				},
				info: currentTrack ? {
					title: currentTrack.title ?? "",
					artist: currentTrack.artist ?? "",
					duration,
					lyrics: currentTrack.lyrics
				} : void 0,
				share: currentTrack ? {
					onShare: handleShareClick,
					copied: shareCopied
				} : void 0,
				...theme
			}),
			/* @__PURE__ */ jsx("div", {
				className: "ap-fc__menu",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ap-icon-btn ap-tap ap-menu__btn",
					onClick: handleOpenOptions,
					"aria-label": "Player options",
					"aria-haspopup": "dialog",
					"aria-expanded": controllerOpen,
					children: /* @__PURE__ */ jsx(DotsIcon$1, {})
				})
			}),
			isEmpty && /* @__PURE__ */ jsxs("div", {
				className: "ap-banner ap-banner--info ap-anim-in",
				role: "status",
				children: [/* @__PURE__ */ jsx(ErrorIcon$1, {}), /* @__PURE__ */ jsx("span", { children: "Queue is empty" })]
			}),
			autoplayBlocked && hasAudio && !hasError && /* @__PURE__ */ jsxs("div", {
				className: "ap-banner ap-banner--info ap-banner--col ap-anim-in",
				role: "status",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "ap-banner__row",
					children: [/* @__PURE__ */ jsx(ErrorIcon$1, {}), /* @__PURE__ */ jsx("span", { children: "Autoplay blocked. Tap play to start audio." })]
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ap-retry-btn",
					onClick: () => {
						s.dismissAutoplayBlocked();
						s.toggle();
					},
					children: "Play"
				})]
			}),
			hasError && hasAudio && /* @__PURE__ */ jsxs("div", {
				className: "ap-banner ap-banner--error ap-banner--col ap-anim-in",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "ap-banner__row",
					children: [/* @__PURE__ */ jsx(ErrorIcon$1, {}), /* @__PURE__ */ jsx("span", { children: errorMessage })]
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ap-retry-btn",
					onClick: s.retry,
					children: "Retry"
				})]
			}),
			!isEmpty && /* @__PURE__ */ jsxs("div", {
				className: "ap-fc__counter",
				children: [
					"Track ",
					currentIndex + 1,
					" of ",
					queue.length,
					shuffle ? " · Shuffle" : "",
					repeatMode !== "off" ? ` · Repeat ${repeatMode}` : "",
					automix ? " · Automix" : ""
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-fc__stage",
				"data-surface-open": surface.mode !== "default",
				children: [/* @__PURE__ */ jsx(PlayerHero, {
					face: "fullCard",
					collapsed: surface.isHeroCollapsed,
					title: currentTrack?.title ?? "Nothing playing",
					artist: currentTrack?.artist ?? "—",
					art: heroArtNode,
					album: currentTrack?.albumTitle,
					featuredArtists: currentTrack?.featuredArtists,
					versionLabel: currentTrack?.versionLabel,
					explicit: currentTrack?.explicit,
					releaseTitle: currentTrack?.releaseTitle,
					subtitle: currentTrack?.subtitle,
					marquee: true,
					titleFont,
					artistFont
				}), /* @__PURE__ */ jsx(SEICanvasHost, {
					open: surface.isCanvasOpen || surface.isQueueOpen,
					face: "fullCard",
					supported: surface.canvasSupported,
					activeSurfaceId: surface.mode === "default" ? void 0 : surface.mode,
					children: surface.isQueueOpen ? /* @__PURE__ */ jsx(QueueSurface, {}) : /* @__PURE__ */ jsx(SEICanvasRenderer, {
						currentTime,
						duration,
						lyrics: currentTrack?.lyrics
					})
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-fc__control-dock",
				children: [
					/* @__PURE__ */ jsx(ScrubberCanvasHost, {
						face: "fullCard",
						density: getScrubberDensity("fullCard"),
						currentTime,
						duration,
						progress: duration > 0 ? currentTime / duration : 0,
						onSeek: s.seek,
						children: /* @__PURE__ */ jsx(ScrubberCanvasRenderer, {
							currentTime,
							duration,
							onSeek: s.seek,
							children: /* @__PURE__ */ jsxs("div", {
								className: "ap-progress-group",
								role: "group",
								"aria-label": "Playback progress",
								children: [/* @__PURE__ */ jsx(WaveformAdapter, {
									face: "fullCard",
									density: getScrubberDensity("fullCard"),
									currentTime,
									duration,
									buffered,
									disabled: !hasAudio,
									isSeeking,
									onSeek: s.seek,
									onSeekStart: () => s.setSeeking(true),
									onSeekEnd: () => s.setSeeking(false),
									peaks: currentTrack?.peaks,
									peaksDuration: currentTrack?.waveformDuration,
									getDecodedData: s.getDecodedData,
									url: s.getBackendInfo().active === "html5" ? s.currentSrc : void 0,
									sourceKey: currentTrack ? trackKey(currentTrack) : void 0
								}), /* @__PURE__ */ jsxs("div", {
									className: "ap-times",
									"aria-hidden": "true",
									children: [/* @__PURE__ */ jsx("span", { children: formatTime(currentTime) }), /* @__PURE__ */ jsx("span", { children: formatTime(duration) })]
								})]
							})
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "ap-transport",
						role: "group",
						"aria-label": "Playback controls",
						children: [
							/* @__PURE__ */ jsx(HoldSkipButton, {
								direction: "previous",
								className: "ap-btn ap-btn--ghost ap-tap",
								disabled: !hasAudio,
								skipDisabled: !canPrevious,
								seekLabel: "Skip backward 10 seconds",
								skipLabel: "Previous track",
								onSeek: () => s.seekBy(-10),
								onSkip: s.previous,
								children: /* @__PURE__ */ jsx(PrevIcon$1, {})
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: `ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`,
								onClick: s.toggle,
								disabled: !hasAudio,
								"aria-label": showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play",
								children: showPlaySpinner ? /* @__PURE__ */ jsx(SpinnerIcon$1, {}) : isPlaying ? /* @__PURE__ */ jsx(PauseIcon$1, {}) : /* @__PURE__ */ jsx(PlayIcon$1, {})
							}),
							/* @__PURE__ */ jsx(HoldSkipButton, {
								direction: "next",
								className: "ap-btn ap-btn--ghost ap-tap",
								disabled: !hasAudio,
								skipDisabled: !canNext,
								seekLabel: "Skip forward 10 seconds",
								skipLabel: "Next track",
								onSeek: () => s.seekBy(10),
								onSkip: s.next,
								children: /* @__PURE__ */ jsx(NextIcon$1, {})
							})
						]
					}),
					showVolume && /* @__PURE__ */ jsx(VolumeControl, {
						volume,
						isMuted,
						disabled: !hasAudio,
						volumeUnsupported,
						onVolumeChange: s.setVolume,
						onToggleMute: s.toggleMute
					}),
					/* @__PURE__ */ jsx(PlayerSurfaceButtons, {
						surface,
						onOpenQueue: handleOpenQueue,
						onOpenFocusedController: handleOpenFocusedController
					})
				]
			})
		]
	}) });
}
//#endregion
//#region src/audio-player/surfaces/ArcActionButton.tsx
/** Map the declarative action tree onto the arc menu's `MenuNode` tree. */
function toMenuNodes(actions) {
	return actions.map((a) => ({
		id: a.id,
		label: a.label,
		icon: a.icon ?? DotsIcon$1,
		state: a.state,
		children: a.children && a.children.length > 0 ? toMenuNodes(a.children) : void 0
	}));
}
/** Flatten leaf actions into an id → action map for O(1) dispatch. */
function indexLeaves(actions, map) {
	for (const a of actions) if (a.children && a.children.length > 0) indexLeaves(a.children, map);
	else map.set(a.id, a);
}
/**
* A generic Arc Action Button: the SEIHouse command-wheel affordance backed by a
* plain `ArcAction[]` model. It is a thin, engine-agnostic adapter over
* `SEICanvasActionMenu` — the trigger is a single button when closed (cheap to
* mount in long lists), and the arc overlay only renders on tap. Any face can
* reuse it as its primary action surface; Vault rows use it in place of the old
* three-dot menu.
*/
function ArcActionButton({ actions, ariaLabel = "Actions", className }) {
	const items = useMemo(() => toMenuNodes(actions), [actions]);
	const leaves = useMemo(() => {
		const map = /* @__PURE__ */ new Map();
		indexLeaves(actions, map);
		return map;
	}, [actions]);
	return /* @__PURE__ */ jsx(SEICanvasActionMenu, {
		items,
		onSelect: (node) => leaves.get(node.id)?.onSelect?.(node.id),
		ariaLabel,
		className
	});
}
//#endregion
//#region src/audio-player/skins/vaultCategories.ts
/**
* Vault category → visual identity. Rows derive their color/status from this map
* (driven by `Track.vaultCategory`) instead of depending on per-row artwork, so
* a long list stays fast, clean, and scannable.
*
* Colors are plain CSS values so the host can keep using its own theme tokens
* elsewhere; override per row via the existing `AudioPlayerTheme` props when a
* different palette is needed.
*/
var VAULT_CATEGORY_META = {
	demo: {
		label: "Demo",
		color: "#7C5CFF"
	},
	beat: {
		label: "Beat",
		color: "#22D3A6"
	},
	mix: {
		label: "Mix",
		color: "#38BDF8"
	},
	master: {
		label: "Master",
		color: "#F5C451"
	},
	memo: {
		label: "Memo",
		color: "#A1A1AA"
	},
	arcNote: {
		label: "Arc Note",
		color: "#FB7185"
	},
	toFinish: {
		label: "To Finish",
		color: "#FB923C"
	},
	archived: {
		label: "Archived",
		color: "#6B7280"
	}
};
/**
* Host-registered custom categories. Kept in a Map (mirroring the visual-slots
* registry) so apps can add their own classifications — or recolor a built-in —
* without editing the library. Checked before the built-ins so a registration
* can override a built-in id.
*/
var CUSTOM_CATEGORIES = /* @__PURE__ */ new Map();
/**
* Register (or replace) a custom Vault category's visual identity. Call once at
* startup; rows reading `track.vaultCategory === id` then pick up the label +
* accent color automatically. Registering under a built-in id overrides it.
*/
function registerVaultCategory(id, meta) {
	CUSTOM_CATEGORIES.set(id, meta);
}
/** Remove all custom registrations, restoring the built-in defaults. Mainly
*  useful for test isolation, or to reset host-defined categories. */
function clearCustomCategories() {
	CUSTOM_CATEGORIES.clear();
}
/**
* Every known category as `[id, meta]` pairs — built-ins first, then custom
* registrations (custom entries that reuse a built-in id appear once, overridden).
* Useful for building a category picker.
*/
function getAllVaultCategories() {
	const merged = new Map(Object.entries(VAULT_CATEGORY_META));
	for (const [id, meta] of CUSTOM_CATEGORIES) merged.set(id, meta);
	return Array.from(merged.entries());
}
/**
* Look up a category's visual identity, or `null` when none is set. Accepts any
* string so custom (host-registered) categories resolve alongside the built-ins;
* custom registrations win. Unknown values return `null`, keeping the contract
* honest against unexpected external data.
*/
function getVaultCategoryMeta(category) {
	if (!category) return null;
	if (CUSTOM_CATEGORIES.has(category)) return CUSTOM_CATEGORIES.get(category);
	return Object.prototype.hasOwnProperty.call(VAULT_CATEGORY_META, category) ? VAULT_CATEGORY_META[category] : null;
}
//#endregion
//#region src/audio-player/skins/VaultRowPlayer.tsx
/** Identify a track within the queue the same way the session's playNow does. */
function sameTrack$1(a, b) {
	return trackKey(a) === trackKey(b);
}
/**
* A slim Vault list row. Each row controls the shared session: pressing play
* starts this track in the one global engine (jumping if it's already queued,
* else appending). When this row is the active track its play button mirrors the
* global play state — so it stays in sync with every other skin.
*
* Capability-driven (`PLAYER_FACE_CAPABILITIES.vaultRow`, CompactPlayer family):
* the most compact face. `supportsSEICanvas: false`, `supportsContextualActions:
* false`, and `supportsScrubberCanvas: false` — a list row mounts **no** scrubber
* of its own; seeking lives on the shared StickyBottom master scrubber that
* follows the active song. It keeps `supportsAction: true`, so it renders a row
* action button. Visual identity comes from the track's `vaultCategory` (accent
* color + status label), not per-row artwork, keeping long lists fast to render.
*/
function VaultRowPlayer({ track, number, actions, onAction, className, style, ...theme }) {
	const s = useAudioSession();
	const isActive = s.currentTrack ? sameTrack$1(s.currentTrack, track) : false;
	const isPlayingThis = isActive && s.isPlaying;
	const isBufferingThis = isActive && s.isBuffering;
	const category = getVaultCategoryMeta(track.vaultCategory);
	const resolvedActions = useMemo(() => {
		if (actions && actions.length > 0) return actions;
		if (onAction) return [{
			id: "more",
			label: "More",
			icon: DotsIcon$1,
			onSelect: () => onAction(track)
		}];
		return [];
	}, [
		actions,
		onAction,
		track
	]);
	const showAction = faceSupportsAction("vaultRow") && resolvedActions.length > 0;
	const handleToggle = () => {
		if (isActive) s.toggle();
		else s.playNow(track);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-vr${isActive ? " ap-vr--active" : ""}${className ? ` ${className}` : ""}`,
		style: {
			...buildThemeVars(theme),
			...category ? { "--ap-vault-accent": category.color } : {},
			...style
		},
		"data-vault-category": track.vaultCategory,
		"aria-current": isActive ? "true" : void 0,
		children: [
			category && /* @__PURE__ */ jsx("span", {
				className: "ap-vr__chip ap-vr__chip--lead",
				title: category.label,
				children: category.label
			}),
			number !== void 0 && /* @__PURE__ */ jsx("span", {
				className: "ap-vr__num",
				children: number
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "ap-btn ap-btn--play ap-vr__play ap-tap",
				onClick: handleToggle,
				"aria-label": isBufferingThis ? "Buffering audio" : isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`,
				children: isBufferingThis ? /* @__PURE__ */ jsx(SpinnerIcon$1, {}) : isPlayingThis ? /* @__PURE__ */ jsx(PauseIcon$1, {}) : /* @__PURE__ */ jsx(PlayIcon$1, {})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-vr__meta",
				children: [/* @__PURE__ */ jsxs("span", {
					className: "ap-vr__title",
					title: formatVersionedTitle(track.title, track.versionLabel),
					children: [formatVersionedTitle(track.title, track.versionLabel), track.explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})]
				}), /* @__PURE__ */ jsxs("span", {
					className: "ap-vr__artist",
					title: formatSecondaryLine(track),
					children: [category && /* @__PURE__ */ jsx("span", {
						className: "ap-vr__chip ap-vr__chip--inline",
						children: category.label
					}), /* @__PURE__ */ jsx("span", {
						className: "ap-vr__artist-text",
						children: formatSecondaryLine(track)
					})]
				})]
			}),
			isActive && /* @__PURE__ */ jsx("span", {
				className: "ap-vr__time",
				"aria-hidden": "true",
				children: formatTime(s.currentTime)
			}),
			isPlayingThis && /* @__PURE__ */ jsxs("span", {
				className: "ap-eq",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ jsx("i", {}),
					/* @__PURE__ */ jsx("i", {}),
					/* @__PURE__ */ jsx("i", {})
				]
			}),
			showAction && /* @__PURE__ */ jsx(ArcActionButton, {
				actions: resolvedActions,
				ariaLabel: `Actions for ${track.title}`,
				className: "ap-vr__action"
			})
		]
	});
}
//#endregion
//#region src/audio-player/skins/StickyBottomPlayer.tsx
/**
* An always-visible now-playing bar (Spotify-style). Reads the shared session,
* so it reflects and controls whatever any other skin is doing. Core transport
* only — shuffle, repeat, automix, queue, info, and share live in the SAP
* Controller behind the "…" button. Renders nothing when the queue is empty.
*
* Capability-driven (`PLAYER_FACE_CAPABILITIES.stickyBottom`): a compact bar
* with `supportsContextualActions: false` — deep actions and queue access route
* through its SAPController three-dot sheet instead of a radial menu, so it does
* not render `PlayerSurfaceButtons`. `supportsSEICanvas: false` (no canvas
* zone). Phase 3 wires its scrubber through `ScrubberCanvasHost` (compact
* density) so the timeline becomes a real plugin mount point.
*/
function StickyBottomPlayer({ fixed = true, showVolume = defaultShowVolume(), className, style, ...theme }) {
	const s = useAudioSession();
	const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
	const [controllerOpen, setControllerOpen] = useState(false);
	const handleOpenQueue = useCallback(() => setQueueDrawerOpen(true), []);
	const handleCloseQueue = useCallback(() => setQueueDrawerOpen(false), []);
	const { share, copied: shareCopied, nativeShare } = useShareTrack(s.currentTrack?.title ?? "", s.currentTrack?.artist ?? "");
	const handleShareClick = useCallback(() => {
		if (nativeShare) setControllerOpen(false);
		share();
	}, [nativeShare, share]);
	if (s.queue.length === 0 || !s.currentTrack) return null;
	const { currentTrack, isPlaying, isBuffering, shuffle, repeatMode, automix } = s;
	const showPlaySpinner = isBuffering;
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-sb${fixed ? " ap-sb--fixed" : ""}${className ? ` ${className}` : ""}`,
		style: {
			...buildThemeVars(theme),
			...style
		},
		role: "region",
		"aria-label": "Playback bar",
		children: [
			/* @__PURE__ */ jsx(QueueDrawer, {
				queue: s.queue,
				currentIndex: s.currentIndex,
				isPlaying: s.isPlaying,
				open: queueDrawerOpen,
				onClose: handleCloseQueue,
				onPlayTrack: s.playTrack,
				onReorder: s.moveQueueItem,
				onRemove: s.removeFromQueue
			}),
			/* @__PURE__ */ jsx(SAPController, {
				open: controllerOpen,
				onClose: () => setControllerOpen(false),
				route: "options",
				playback: {
					shuffle,
					onToggleShuffle: s.toggleShuffle,
					repeatMode,
					onCycleRepeat: s.cycleRepeat,
					automix,
					onToggleAutomix: s.toggleAutomix
				},
				queue: {
					count: s.queue.length,
					onOpenQueue: handleOpenQueue
				},
				info: {
					title: currentTrack.title ?? "",
					artist: currentTrack.artist ?? "",
					duration: s.duration,
					lyrics: currentTrack.lyrics
				},
				share: {
					onShare: handleShareClick,
					copied: shareCopied
				},
				...theme
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-sb__inner",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "ap-sb__meta",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "ap-sb__title",
							title: formatVersionedTitle(currentTrack.title, currentTrack.versionLabel),
							children: [formatVersionedTitle(currentTrack.title, currentTrack.versionLabel), currentTrack.explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})]
						}), /* @__PURE__ */ jsx("span", {
							className: "ap-sb__artist",
							title: formatSecondaryLine(currentTrack),
							children: formatSecondaryLine(currentTrack)
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "ap-sb__center",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "ap-sb__controls",
							children: [
								/* @__PURE__ */ jsx(HoldSkipButton, {
									direction: "previous",
									className: "ap-btn ap-btn--ghost ap-btn--sm ap-tap",
									disabled: !s.hasAudio,
									skipDisabled: !s.canPrevious,
									seekLabel: "Skip backward 10 seconds",
									skipLabel: "Previous track",
									onSeek: () => s.seekBy(-10),
									onSkip: s.previous,
									children: /* @__PURE__ */ jsx(PrevIcon$1, {})
								}),
								/* @__PURE__ */ jsx("button", {
									type: "button",
									className: `ap-btn ap-btn--play ap-sb__play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`,
									onClick: s.toggle,
									disabled: !s.hasAudio,
									"aria-label": showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play",
									children: showPlaySpinner ? /* @__PURE__ */ jsx(SpinnerIcon$1, {}) : isPlaying ? /* @__PURE__ */ jsx(PauseIcon$1, {}) : /* @__PURE__ */ jsx(PlayIcon$1, {})
								}),
								/* @__PURE__ */ jsx(HoldSkipButton, {
									direction: "next",
									className: "ap-btn ap-btn--ghost ap-btn--sm ap-tap",
									disabled: !s.hasAudio,
									skipDisabled: !s.canNext,
									seekLabel: "Skip forward 10 seconds",
									skipLabel: "Next track",
									onSeek: () => s.seekBy(10),
									onSkip: s.next,
									children: /* @__PURE__ */ jsx(NextIcon$1, {})
								}),
								/* @__PURE__ */ jsx("button", {
									type: "button",
									className: "ap-icon-btn ap-tap",
									onClick: () => setControllerOpen(true),
									"aria-label": "Player options",
									"aria-haspopup": "dialog",
									"aria-expanded": controllerOpen,
									children: /* @__PURE__ */ jsx(DotsIcon$1, {})
								})
							]
						}), /* @__PURE__ */ jsxs("div", {
							className: "ap-sb__scrub",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "ap-sb__t",
									"aria-hidden": "true",
									children: formatTime(s.currentTime)
								}),
								/* @__PURE__ */ jsx(ScrubberCanvasHost, {
									face: "stickyBottom",
									density: getScrubberDensity("stickyBottom"),
									currentTime: s.currentTime,
									duration: s.duration,
									progress: s.duration > 0 ? s.currentTime / s.duration : 0,
									onSeek: s.seek,
									children: /* @__PURE__ */ jsx(WaveformAdapter, {
										face: "stickyBottom",
										density: getScrubberDensity("stickyBottom"),
										currentTime: s.currentTime,
										duration: s.duration,
										buffered: s.buffered,
										disabled: !s.hasAudio,
										isSeeking: s.isSeeking,
										onSeek: s.seek,
										onSeekStart: () => s.setSeeking(true),
										onSeekEnd: () => s.setSeeking(false)
									})
								}),
								/* @__PURE__ */ jsx("span", {
									className: "ap-sb__t",
									"aria-hidden": "true",
									children: formatTime(s.duration)
								})
							]
						})]
					}),
					showVolume && /* @__PURE__ */ jsx("div", {
						className: "ap-sb__volume",
						children: /* @__PURE__ */ jsx(VolumeControl, {
							volume: s.volume,
							isMuted: s.isMuted,
							disabled: !s.hasAudio,
							volumeUnsupported: s.volumeUnsupported,
							onVolumeChange: s.setVolume,
							onToggleMute: s.toggleMute
						})
					})
				]
			})
		]
	});
}
//#endregion
//#region src/audio-player/skins/MiniSidebarPlayer.tsx
/**
* A condensed widget for a sidebar: small art, current track, play/pause, and
* the action menu. Reads the shared session so it always shows what is globally
* playing.
*
* Capability-driven (`PLAYER_FACE_CAPABILITIES.miniSidebar`, CompactPlayer
* family): a compact face. `supportsSEICanvas: false`, so the canvas zone and its
* left surface button are auto-hidden. `supportsScrubberCanvas: false` — the mini
* mounts **no** scrubber; seeking lives on the shared StickyBottom master. It is
* the only compact face with the contextual radial menu
* (`supportsContextualActions`), which is also where skip/next now live (via
* `showTransport`) — freeing the row for title/artist instead of a Next button.
* `PlayerSurfaceButtons` reads the capability flags from the model, so passing
* `surface` plus the transport wiring yields the correct menu.
*/
function MiniSidebarPlayer({ art = "linear-gradient(135deg,#7C5CFF,#22D3A6)", artMedia, className, style, ...theme }) {
	const s = useAudioSession();
	const surface = usePlayerSurface("miniSidebar");
	const blockArt = resolveMedia({
		media: artMedia,
		legacyCss: art
	});
	const { currentTrack, isPlaying, isBuffering, hasAudio } = s;
	const msTitle = currentTrack ? formatVersionedTitle(currentTrack.title, currentTrack.versionLabel) : "Nothing playing";
	const msSecondary = currentTrack ? formatSecondaryLine(currentTrack) : "—";
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-ms-shell${className ? ` ${className}` : ""}`,
		style: {
			...buildThemeVars(theme),
			...style
		},
		children: [/* @__PURE__ */ jsxs("div", {
			className: "ap-ms ap-glass-surface ap-glass-surface--compact",
			role: "region",
			"aria-label": "Mini player",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: `ap-ms__art${isPlaying ? " ap-ms__art--playing" : ""}`,
					style: blockArt.cssBackground ? { backgroundImage: blockArt.cssBackground } : void 0,
					"aria-hidden": "true",
					children: blockArt.media && /* @__PURE__ */ jsx(BackgroundMedia, {
						media: blockArt.media,
						className: "ap-ms__bg"
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "ap-ms__meta",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "ap-ms__title",
						title: msTitle,
						children: [msTitle, currentTrack?.explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})]
					}), /* @__PURE__ */ jsx("span", {
						className: "ap-ms__artist",
						title: msSecondary,
						children: msSecondary
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ap-btn ap-btn--play ap-ms__play ap-tap",
					onClick: s.toggle,
					disabled: !hasAudio,
					"aria-label": isBuffering ? "Buffering audio" : isPlaying ? "Pause" : "Play",
					children: isBuffering ? /* @__PURE__ */ jsx(SpinnerIcon$1, {}) : isPlaying ? /* @__PURE__ */ jsx(PauseIcon$1, {}) : /* @__PURE__ */ jsx(PlayIcon$1, {})
				}),
				/* @__PURE__ */ jsx(PlayerSurfaceButtons, {
					surface,
					showTransport: true,
					canPrevious: s.canPrevious,
					canNext: s.canNext,
					onPrevious: s.previous,
					onNext: s.next
				})
			]
		}), /* @__PURE__ */ jsx("div", {
			className: "ap-ms__surface",
			"data-open": surface.isQueueOpen ? "true" : "false",
			children: surface.isQueueOpen && /* @__PURE__ */ jsx(QueueSurface, { maxItems: 6 })
		})]
	});
}
//#endregion
//#region src/audio-player/skins/SeaCardPlayer.tsx
/** Identify a track within the queue (matches the session's playNow logic). */
function sameTrack(a, b) {
	return trackKey(a) === trackKey(b);
}
/**
* An embeddable "SEA card" surface — a marketplace/album card with an overlaid
* play button that plays its track in the global session. When its track is the
* active one it shows live progress and a pause state, kept in sync with every
* other skin through the shared engine.
*
* Capability-driven (`PLAYER_FACE_CAPABILITIES.seaCard`): a marketplace card.
* `supportsContextualActions: false`, so it renders no contextual menu — taps on
* the card are about previewing/playing the track, not deep actions. The inline
* scrubber stays a plain progress bar; Phase 4 adds a small wave trigger on the
* active card that opens the overlay `SEICanvasHost`, which shows the hero +
* the interactive `WaveformAdapter` (`supportsWaveform: true`). No radial menu is
* added — the card stays clean and tap-to-play.
*/
function SeaCardPlayer({ track, art = "linear-gradient(135deg,#FF7AC6,#7C5CFF)", artMedia, tag, actions, titleFont, artistFont, className, style, ...theme }) {
	const s = useAudioSession();
	const surface = usePlayerSurface("seaCard");
	const isActive = s.currentTrack ? sameTrack(s.currentTrack, track) : false;
	const hasPeaks = (track.peaks?.length ?? 0) > 0 && (track.peaks?.[0]?.length ?? 0) > 0;
	const isPlayingThis = isActive && s.isPlaying;
	const isBufferingThis = isActive && s.isBuffering;
	const showAction = faceSupportsAction("seaCard") && (actions?.length ?? 0) > 0;
	const handleToggle = () => {
		if (isActive) s.toggle();
		else s.playNow(track);
	};
	const cardArt = resolveMedia({
		media: artMedia,
		legacyCss: art
	});
	return /* @__PURE__ */ jsxs("article", {
		className: `ap-sea${isActive ? " ap-sea--active" : ""}${className ? ` ${className}` : ""}`,
		style: {
			...buildThemeVars(theme),
			...style
		},
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "ap-sea__art",
				style: cardArt.cssBackground ? { backgroundImage: cardArt.cssBackground } : void 0,
				children: [
					cardArt.media && /* @__PURE__ */ jsx(BackgroundMedia, {
						media: cardArt.media,
						className: "ap-sea__bg"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "ap-btn ap-btn--play ap-sea__play ap-tap",
						onClick: handleToggle,
						"aria-label": isBufferingThis ? "Buffering audio" : isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`,
						children: isBufferingThis ? /* @__PURE__ */ jsx(SpinnerIcon$1, {}) : isPlayingThis ? /* @__PURE__ */ jsx(PauseIcon$1, {}) : /* @__PURE__ */ jsx(PlayIcon$1, {})
					}),
					tag && /* @__PURE__ */ jsx("span", {
						className: "ap-sea__tag",
						children: tag
					}),
					isActive && hasPeaks && /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "ap-icon-btn ap-tap ap-sea__wave-btn",
						onClick: surface.toggleCanvas,
						"aria-label": surface.isCanvasOpen ? "Hide waveform" : "Show waveform",
						"aria-expanded": surface.isCanvasOpen,
						children: /* @__PURE__ */ jsx(WaveIcon, {})
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-sea__body",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "ap-sea__head",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "ap-sea__meta",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "ap-sea__title",
							title: formatVersionedTitle(track.title, track.versionLabel),
							style: titleFont,
							children: [formatVersionedTitle(track.title, track.versionLabel), track.explicit && /* @__PURE__ */ jsx(ExplicitBadge, {})]
						}), /* @__PURE__ */ jsx("div", {
							className: "ap-sea__artist",
							title: formatSecondaryLine(track),
							style: artistFont,
							children: formatSecondaryLine(track)
						})]
					}), showAction && /* @__PURE__ */ jsx(ArcActionButton, {
						actions,
						ariaLabel: `Actions for ${track.title}`,
						className: "ap-sea__action"
					})]
				}), isActive && !surface.isCanvasOpen && /* @__PURE__ */ jsx("div", {
					className: "ap-sea__progress",
					children: /* @__PURE__ */ jsx(ScrubberCanvasHost, {
						face: "seaCard",
						density: getScrubberDensity("seaCard"),
						currentTime: s.currentTime,
						duration: s.duration,
						progress: s.duration > 0 ? s.currentTime / s.duration : 0,
						onSeek: s.seek,
						children: /* @__PURE__ */ jsx(ProgressBar, {
							currentTime: s.currentTime,
							duration: s.duration,
							buffered: s.buffered,
							disabled: !s.hasAudio,
							isSeeking: s.isSeeking,
							onSeek: s.seek,
							onSeekStart: () => s.setSeeking(true),
							onSeekEnd: () => s.setSeeking(false)
						})
					})
				})]
			}),
			/* @__PURE__ */ jsx(SEICanvasHost, {
				open: surface.isCanvasOpen,
				face: "seaCard",
				supported: isActive && surface.canvasSupported,
				activeSurfaceId: surface.mode === "default" ? void 0 : surface.mode,
				children: surface.isCanvasOpen && /* @__PURE__ */ jsxs("div", {
					className: "ap-sea__overlay",
					children: [/* @__PURE__ */ jsx(PlayerHero, {
						face: "seaCard",
						collapsed: false,
						title: track.title ?? "",
						artist: track.artist ?? "",
						album: track.albumTitle,
						featuredArtists: track.featuredArtists,
						versionLabel: track.versionLabel,
						explicit: track.explicit,
						releaseTitle: track.releaseTitle,
						subtitle: track.subtitle,
						marquee: true
					}), /* @__PURE__ */ jsx(WaveformAdapter, {
						face: "seaCard",
						density: getScrubberDensity("seaCard"),
						currentTime: s.currentTime,
						duration: s.duration,
						buffered: s.buffered,
						disabled: !s.hasAudio,
						isSeeking: s.isSeeking,
						onSeek: s.seek,
						onSeekStart: () => s.setSeeking(true),
						onSeekEnd: () => s.setSeeking(false),
						peaks: track.peaks,
						peaksDuration: track.waveformDuration,
						getDecodedData: s.getDecodedData,
						url: s.getBackendInfo().active === "html5" ? s.currentSrc : void 0,
						sourceKey: trackKey(track)
					})]
				})
			})
		]
	});
}
//#endregion
//#region src/audio-player/narrative/useNarrativeAudio.ts
function clamp01$1(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
/**
* Headless orchestrator for the Narrative face. It layers three audio sources
* over existing SAP primitives without changing engine behavior:
*
* - **Narration / voice** → the shared global session (`useAudioSession`). The
*   current session track is the narration; play/pause/mute/volume all route to
*   it, so any other SAP face stays in sync.
* - **Ambience loop + FX** → a private `AudioSpriteEngine`. The `ambientProfile`
*   names a looping clip in `ambienceManifest`; `fxClip` is an optional extra
*   layer.
*
* Behaviors it wires for story playback:
* - **Ducking** — while narration plays, ambience fades to
*   `ambienceVolume * (1 - duckAmount)` (scaled by `intensity`), and restores on
*   pause.
* - **Crossfade** — when `sceneMood`/`ambientProfile` changes, the old ambience
*   instance fades out (and stops) while the new clip fades in.
*
* With no `ambienceManifest`, ambience is inert and the face is a narration-only
* transport. The reader app feeds scene metadata in via the options; the UI does
* not need to change.
*/
function useNarrativeAudio(options = {}) {
	const { sceneMood, ambientProfile, fxClip, fxLoop = false, ambienceManifest, narrationState, intensity = 1, ambienceVolume: ambienceVolumeProp = .6, narrationVolume: narrationVolumeProp, duckAmount = .6, crossfadeMs = 1200 } = options;
	const session = useAudioSession();
	const engineRef = useRef(null);
	const ambienceIdRef = useRef(null);
	const fxIdRef = useRef(null);
	const loadedSrcRef = useRef(null);
	const [ambienceVolume, setAmbienceVolumeState] = useState(clamp01$1(ambienceVolumeProp));
	useEffect(() => {
		setAmbienceVolumeState(clamp01$1(ambienceVolumeProp));
	}, [ambienceVolumeProp]);
	const getEngine = useCallback(() => {
		if (!engineRef.current) engineRef.current = createAudioSpriteEngine();
		return engineRef.current;
	}, []);
	const targetAmbience = clamp01$1(ambienceVolume * clamp01$1(intensity));
	const isNarrating = narrationState === "playing" || narrationState === void 0 && session.isPlaying;
	const duckedAmbience = clamp01$1(targetAmbience * (1 - clamp01$1(duckAmount) * clamp01$1(intensity)));
	const liveAmbienceTarget = isNarrating ? duckedAmbience : targetAmbience;
	useEffect(() => {
		const src = ambienceManifest?.src?.trim();
		if (!src) {
			const engine = engineRef.current;
			if (engine) {
				if (ambienceIdRef.current) engine.fadeOut(ambienceIdRef.current, crossfadeMs);
				if (fxIdRef.current) engine.stop(fxIdRef.current);
			}
			ambienceIdRef.current = null;
			fxIdRef.current = null;
			loadedSrcRef.current = null;
			return;
		}
		const engine = getEngine();
		let cancelled = false;
		const run = async () => {
			if (loadedSrcRef.current !== src) {
				loadedSrcRef.current = src;
				try {
					await engine.load(ambienceManifest);
				} catch {
					loadedSrcRef.current = null;
					return;
				}
			} else await engine.ready();
			if (cancelled) return;
			engine.setMasterVolume(1);
			if (ambientProfile) {
				const previous = ambienceIdRef.current;
				const next = engine.play(ambientProfile, {
					loop: true,
					volume: 0
				});
				if (next) {
					ambienceIdRef.current = next;
					engine.fade(next, liveAmbienceTarget, crossfadeMs);
				} else ambienceIdRef.current = null;
				if (previous) engine.fadeOut(previous, crossfadeMs);
			} else if (ambienceIdRef.current) {
				engine.fadeOut(ambienceIdRef.current, crossfadeMs);
				ambienceIdRef.current = null;
			}
			if (fxIdRef.current) {
				engine.stop(fxIdRef.current);
				fxIdRef.current = null;
			}
			if (fxClip) fxIdRef.current = engine.play(fxClip, {
				loop: fxLoop,
				volume: liveAmbienceTarget
			});
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [
		ambienceManifest?.src,
		ambientProfile,
		sceneMood,
		fxClip,
		fxLoop
	]);
	useEffect(() => {
		const engine = engineRef.current;
		if (!engine) return;
		if (ambienceIdRef.current) engine.fade(ambienceIdRef.current, liveAmbienceTarget, 350);
		if (fxIdRef.current) engine.fade(fxIdRef.current, liveAmbienceTarget, 350);
	}, [liveAmbienceTarget]);
	useEffect(() => {
		if (narrationVolumeProp === void 0) return;
		session.setVolume(clamp01$1(narrationVolumeProp));
	}, [narrationVolumeProp, session]);
	useEffect(() => {
		return () => {
			engineRef.current?.dispose();
			engineRef.current = null;
			ambienceIdRef.current = null;
			fxIdRef.current = null;
		};
	}, []);
	const setAmbienceVolume = useCallback((value) => {
		setAmbienceVolumeState(clamp01$1(value));
	}, []);
	const setNarrationVolume = useCallback((value) => session.setVolume(clamp01$1(value)), [session]);
	const hasAmbience = Boolean(ambienceManifest?.src?.trim()) && Boolean(ambientProfile);
	const indicatorState = isNarrating ? "narrating" : hasAmbience ? "ambient" : "silent";
	return {
		isPlaying: session.isPlaying,
		isMuted: session.isMuted,
		hasNarration: session.hasAudio,
		hasAmbience,
		mood: sceneMood,
		indicatorState,
		ambienceVolume,
		narrationVolume: session.volume,
		togglePlay: session.toggle,
		toggleMute: session.toggleMute,
		setAmbienceVolume,
		setNarrationVolume
	};
}
//#endregion
//#region src/audio-player/skins/NarrativeFace.tsx
/**
* A "faceless" SAP control surface for story/reader apps. It keeps the full SAP
* audio engine underneath — narration on the shared session, ambience/FX on the
* sprite layer (see {@link useNarrativeAudio}) — but presents only story-native
* controls: a soundscape indicator, play/pause, mute, and ambience + narration
* volume, with an optional expand/settings affordance.
*
* It deliberately renders none of the music-player chrome (no album art,
* artwork, shuffle, repeat, queue, or waveform), per its `narrative`-family
* capability declaration. Pass `embedded` to pin it as a tiny bottom overlay in
* a reader. Scene metadata (`sceneMood`, `ambientProfile`, `intensity`, …) is
* accepted as props so a host like the Light Novels app can feed scenes in
* without the UI changing.
*/
function NarrativeFace({ chapterId, sceneMood, ambientProfile, fxClip, fxLoop, ambienceManifest, narrationState, intensity, ambienceVolume, narrationVolume, duckAmount, crossfadeMs, embedded = false, showExpand = false, onExpand, className, style, ...theme }) {
	const session = useAudioSession();
	const narrative = useNarrativeAudio({
		chapterId,
		sceneMood,
		ambientProfile,
		fxClip,
		fxLoop,
		ambienceManifest,
		narrationState,
		intensity,
		ambienceVolume,
		narrationVolume,
		duckAmount,
		crossfadeMs
	});
	const handleAmbienceChange = useCallback((e) => {
		narrative.setAmbienceVolume(Number(e.target.value) / 100);
	}, [narrative]);
	const showSpinner = session.isBuffering;
	const moodLabel = narrative.mood ?? "Ambience";
	return /* @__PURE__ */ jsxs("div", {
		className: `ap-nf${embedded ? " ap-nf--embedded" : ""} ap-nf--${narrative.indicatorState}${className ? ` ${className}` : ""}`,
		style: {
			...buildThemeVars(theme),
			...style
		},
		role: "region",
		"aria-label": "Narration audio",
		"data-chapter-id": chapterId,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "ap-nf__scape",
				title: `Soundscape: ${moodLabel}`,
				children: [/* @__PURE__ */ jsx("span", {
					className: "ap-nf__dot",
					"aria-hidden": "true"
				}), /* @__PURE__ */ jsx("span", {
					className: "ap-nf__mood",
					children: moodLabel
				})]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: `ap-btn ap-btn--play ap-nf__play ap-tap${narrative.isPlaying ? " ap-btn--play-active" : ""}`,
				onClick: narrative.togglePlay,
				disabled: !narrative.hasNarration,
				"aria-label": showSpinner ? "Buffering narration" : narrative.isPlaying ? "Pause narration" : "Play narration",
				children: showSpinner ? /* @__PURE__ */ jsx(SpinnerIcon$1, {}) : narrative.isPlaying ? /* @__PURE__ */ jsx(PauseIcon$1, {}) : /* @__PURE__ */ jsx(PlayIcon$1, {})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ap-nf__vol ap-nf__vol--narration",
				children: [/* @__PURE__ */ jsx("span", {
					className: "ap-nf__vol-label",
					"aria-hidden": "true",
					children: "Voice"
				}), /* @__PURE__ */ jsx(VolumeControl, {
					volume: narrative.narrationVolume,
					isMuted: narrative.isMuted,
					disabled: !narrative.hasNarration,
					volumeUnsupported: session.volumeUnsupported,
					onVolumeChange: narrative.setNarrationVolume,
					onToggleMute: narrative.toggleMute
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "ap-nf__vol ap-nf__vol--ambience",
				children: [/* @__PURE__ */ jsx("span", {
					className: "ap-nf__vol-label",
					children: "Ambience"
				}), /* @__PURE__ */ jsx("input", {
					className: "ap-nf__range",
					type: "range",
					min: 0,
					max: 100,
					value: Math.round(narrative.ambienceVolume * 100),
					disabled: !narrative.hasAmbience,
					onChange: handleAmbienceChange,
					"aria-label": "Ambience volume"
				})]
			}),
			showExpand && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "ap-icon-btn ap-nf__expand ap-tap",
				onClick: onExpand,
				"aria-label": "Soundscape settings",
				children: /* @__PURE__ */ jsx(DotsIcon$1, {})
			})
		]
	});
}
//#endregion
//#region src/audio-player/narrative/SceneMixEngine.ts
/**
* Default crossfade length for scene switches. Shorter than the music-player
* `AUTOMIX_FADE_MS`: a narrative cue ("the boss appears") wants the score to
* turn over in a couple of seconds, not a DJ-length blend.
*/
var SCENE_FADE_MS = 2e3;
/** Ramp tick interval — wall-clock so throttled background tabs keep fading. */
var TICK_MS = 33;
function clamp01(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
/**
* A latched "this browser ignores programmatic volume" flag (iOS Safari).
* Once detected, crossfades degrade to hard swaps instead of silently doing
* nothing — the scene still changes, it just cuts.
*/
var volumeWritesUnsupported = false;
/**
* Cue-driven two-deck crossfader for scene scores (reader BGM, ambient beds).
*
* `AutomixPlugin` blends playlist tracks at their natural *end*; a narrative
* host instead needs "switch to this track *now*" mid-track, whenever the
* story's mood changes. This engine reuses the same building blocks — an
* equal-power cos/sin ramp on a wall-clock interval, deck parking at the
* silence-trim start via the shared Automix Lite analysis, autoplay-rejection
* and volume-locked-browser fallbacks — behind one imperative call:
*
* ```ts
* const mix = createSceneMixEngine()
* mix.setLevel(0.4)
* mix.crossfadeTo({ id: "BOSS_1", title: "Boss 1", audioFile: url })
* ```
*
* Headless by design: it renders nothing and owns detached `Audio` elements,
* so a host can keep its existing UI untouched. Level/mute changes re-target
* live (including mid-fade), matching how the Automix ramp re-reads the user
* volume every tick.
*/
var SceneMixEngine = class {
	decks = [];
	active = null;
	level = 1;
	muted = false;
	loop;
	defaultFadeMs;
	tickTimer = null;
	disposed = false;
	constructor(options = {}) {
		this.loop = options.loop ?? true;
		this.defaultFadeMs = Math.max(0, options.fadeMs ?? 2e3);
	}
	/** Key of the track currently owning the mix (fading in or steady). */
	getCurrentTrackKey() {
		return this.active?.key ?? null;
	}
	/**
	* Set the effective output level (0..1) for the whole scene layer. The
	* host owns any composition (user volume × intensity × layer share) and
	* hands the result here; mid-fade changes re-target on the next tick.
	*/
	setLevel(value) {
		this.level = clamp01(value);
		this.applyGains();
	}
	getLevel() {
		return this.level;
	}
	/** Mute/unmute without losing playback position or fade state. */
	setMuted(muted) {
		this.muted = muted;
		for (const deck of this.decks) deck.el.muted = muted;
		this.applyGains();
	}
	getMuted() {
		return this.muted;
	}
	/**
	* Crossfade the scene score to `track`. The incoming deck parks at the
	* track's silence-trim start (when analysis is available) so the fade
	* never runs through dead air. Calling again mid-fade retires every
	* audible deck toward silence and hands the mix to the newest track; a
	* repeat call for the already-active track is a no-op.
	*/
	crossfadeTo(track, options = {}) {
		if (this.disposed || typeof Audio === "undefined") return;
		const src = getPrimaryTrackSource(track);
		if (!src) return;
		const key = trackKey(track);
		if (this.active && this.active.key === key && !this.active.retiring) return;
		const fadeMs = Math.max(0, options.fadeMs ?? this.defaultFadeMs);
		const el = new Audio();
		el.loop = this.loop;
		el.preload = "auto";
		el.crossOrigin = "anonymous";
		el.muted = this.muted;
		try {
			el.volume = 0;
		} catch {
			volumeWritesUnsupported = true;
		}
		const abort = new AbortController();
		const deck = {
			el,
			key,
			curveGain: 0,
			rampT0: performance.now(),
			rampFromGain: 0,
			rampToGain: 1,
			rampMs: volumeWritesUnsupported ? 0 : fadeMs,
			retiring: false,
			abort
		};
		const applyTrimStart = () => {
			const startMs = getTrackTrims(track)?.trimStartMs ?? 0;
			if (startMs <= 0) return;
			if (el.paused && el.readyState >= 1) try {
				el.currentTime = startMs / 1e3;
			} catch {}
		};
		el.addEventListener("loadedmetadata", applyTrimStart, { signal: abort.signal });
		el.addEventListener("error", () => {
			this.releaseDeck(deck);
		}, { signal: abort.signal });
		ensureTrackAnalysis(track).then(() => {
			if (!abort.signal.aborted && !deck.retiring) applyTrimStart();
		});
		el.src = src;
		for (const other of this.decks) this.retire(other, fadeMs);
		this.decks.push(deck);
		this.active = deck;
		let playPromise;
		try {
			el.load();
			playPromise = el.play();
		} catch {
			this.releaseDeck(deck);
			return;
		}
		playPromise?.catch(() => {
			if (!this.decks.includes(deck)) return;
			const wasNewest = this.decks[this.decks.length - 1] === deck;
			this.releaseDeck(deck);
			if (!wasNewest) return;
			const survivor = this.decks[this.decks.length - 1];
			if (survivor) {
				this.unretire(survivor, fadeMs);
				this.active = survivor;
			}
		});
		this.applyGains();
		this.startTicking();
	}
	/** Fade the whole scene layer to silence and release every deck. */
	stop(fadeMs = this.defaultFadeMs) {
		for (const deck of this.decks) this.retire(deck, fadeMs);
		this.active = null;
		this.startTicking();
	}
	dispose() {
		this.disposed = true;
		this.stopTicking();
		for (const deck of [...this.decks]) this.releaseDeck(deck);
		this.active = null;
	}
	retire(deck, fadeMs) {
		if (deck.retiring) return;
		deck.retiring = true;
		deck.rampT0 = performance.now();
		deck.rampFromGain = deck.curveGain;
		deck.rampToGain = 0;
		deck.rampMs = volumeWritesUnsupported ? 0 : fadeMs;
		if (this.active === deck) this.active = null;
	}
	/** Bring a retiring deck back (the switch that displaced it fell through). */
	unretire(deck, fadeMs) {
		deck.retiring = false;
		deck.rampT0 = performance.now();
		deck.rampFromGain = deck.curveGain;
		deck.rampToGain = 1;
		deck.rampMs = volumeWritesUnsupported ? 0 : fadeMs;
		this.startTicking();
	}
	/**
	* Advance every in-flight ramp along the equal-power curve and write the
	* composed gain to each element. Mirrors `AutomixPlugin.runRamp`: fade-in
	* follows sin(t·π/2), fade-out follows g₀·cos(t·π/2), and the write is
	* verified so volume-locked browsers latch the hard-swap fallback instead
	* of fading silently into nothing.
	*/
	tick = () => {
		const now = performance.now();
		let anyRamping = false;
		for (const deck of [...this.decks]) {
			const t = deck.rampMs <= 0 ? 1 : Math.min(1, (now - deck.rampT0) / deck.rampMs);
			if (deck.rampToGain > deck.rampFromGain) {
				const span = deck.rampToGain - deck.rampFromGain;
				deck.curveGain = deck.rampFromGain + span * Math.sin(t * Math.PI / 2);
			} else deck.curveGain = deck.rampFromGain * Math.cos(t * Math.PI / 2);
			if (t < 1) anyRamping = true;
			else if (deck.retiring) {
				this.releaseDeck(deck);
				continue;
			}
			this.applyDeckGain(deck);
		}
		if (!anyRamping) this.stopTicking();
	};
	applyGains() {
		for (const deck of this.decks) this.applyDeckGain(deck);
	}
	applyDeckGain(deck) {
		if (volumeWritesUnsupported) return;
		const target = clamp01(deck.curveGain * this.level);
		try {
			deck.el.volume = target;
			if (this.level > .1 && Math.abs(deck.el.volume - target) > .05) volumeWritesUnsupported = true;
		} catch {
			volumeWritesUnsupported = true;
		}
	}
	startTicking() {
		if (this.tickTimer !== null || this.disposed) return;
		this.tickTimer = setInterval(this.tick, TICK_MS);
	}
	stopTicking() {
		if (this.tickTimer !== null) {
			clearInterval(this.tickTimer);
			this.tickTimer = null;
		}
	}
	releaseDeck(deck) {
		deck.abort.abort();
		this.decks = this.decks.filter((d) => d !== deck);
		if (this.active === deck) this.active = null;
		try {
			deck.el.pause();
			deck.el.removeAttribute("src");
			deck.el.load();
		} catch {}
	}
};
function createSceneMixEngine(options = {}) {
	return new SceneMixEngine(options);
}
//#endregion
//#region src/audio-player/plugins/registry/usePluginRegistry.tsx
var availablePlugins = [
	{
		id: "keyboard-shortcuts",
		label: "Keyboard Shortcuts",
		description: "Space/J/K/L/N/P keyboard controls scoped to the player root. Conflicts with the player's built-in key handler are suppressed.",
		factory: () => createKeyboardShortcutPlugin({
			name: "registry-keyboard-shortcuts",
			enablePlaylistKeys: true
		}),
		defaultActive: true,
		category: "playback"
	},
	{
		id: "analytics",
		label: "Analytics",
		description: "Emits play/pause/seek/stop events to a callback or endpoint. Default: console.table output -- no network traffic.",
		factory: () => createAnalyticsPlugin({
			name: "registry-analytics",
			includeTimeUpdates: false,
			send: (event) => {
				if (typeof console !== "undefined") console.table([{
					type: event.type,
					track: event.track?.title ?? "(none)",
					position: event.position.toFixed(1),
					duration: event.duration.toFixed(1)
				}]);
			}
		}),
		defaultActive: false,
		category: "analytics"
	},
	{
		id: "lyrics",
		label: "Lyrics Sync",
		description: "Displays LRC-style lyrics synced to playback time. Comes with a sample lyric set so the effect is visible immediately.",
		factory: () => createLyricsPlugin({
			name: "registry-lyrics",
			lyrics: SAMPLE_LYRICS,
			onLineChange: (line) => {
				if (typeof document !== "undefined") {
					const el = document.getElementById("registry-lyrics-line");
					if (el) el.textContent = line?.text ?? "";
				}
			}
		}),
		defaultActive: false,
		category: "ui"
	},
	{
		id: "sleep-timer",
		label: "Sleep Timer",
		description: "Adds a sleep-timer dropdown to the player root. Supports 15/30/45/60-minute counts and end-of-track.",
		factory: () => createSleepTimerPlugin({ name: "registry-sleep-timer" }),
		defaultActive: false,
		category: "ui"
	},
	{
		id: "automix",
		label: "Automix",
		description: "Beat/BPM-aware crossfades between playlist tracks, with automatic light-mode fallback (silence-based trims) when analysis is unavailable or low-confidence. No setup required.",
		factory: () => createAutomixPlugin({ name: "registry-automix" }),
		defaultActive: false,
		category: "playback"
	},
	{
		id: "auto-theme",
		label: "Auto Theme",
		description: "Derives the player's accent, progress gradient, background tint, text contrast, and ambient glow from the album artwork.",
		factory: () => createAutoThemePlugin({ name: "registry-auto-theme" }),
		defaultActive: false,
		category: "ui"
	},
	{
		id: "waveform",
		label: "Waveform",
		description: "Replaces the progress bar with an interactive wavesurfer waveform on players that support it. Adds a Show Waveform toggle in the player's options.",
		factory: () => createWaveformPlugin({ name: "registry-waveform" }),
		defaultActive: false,
		category: "ui"
	}
];
var SAMPLE_LYRICS = [
	"[00:00.00]Plugin registry ready",
	"[00:04.00]Browse available plugins",
	"[00:08.00]Install what you need",
	"[00:12.00]Toggle them on and off",
	"[00:16.00]Watch playback stay smooth"
].join("\n");
var PluginRegistryContext = createContext(null);
/**
* Wraps children with a plugin registry context.
* Tracks which plugins are installed and which are active.
* Exposes `activeInstances` – a stable array of `AudioPlayerPlugin` objects
* that can be passed directly into `<AudioPlayer plugins={...} />`.
*
* The provider only materialises instances for **active** plugins, so an
* installed-but-inactive plugin does not consume slots in the player.
*/
function PluginRegistryProvider({ children }) {
	const [installed, setInstalled] = useState(() => availablePlugins.filter((e) => e.defaultActive).map((entry) => ({
		entry,
		active: entry.defaultActive
	})));
	const revRef = useRef(0);
	const install = useCallback((id) => {
		const entry = availablePlugins.find((e) => e.id === id);
		if (!entry) return;
		setInstalled((prev) => {
			if (prev.some((r) => r.entry.id === id)) return prev;
			revRef.current++;
			return [...prev, {
				entry,
				active: entry.defaultActive
			}];
		});
	}, []);
	const uninstall = useCallback((id) => {
		setInstalled((prev) => {
			const next = prev.filter((r) => r.entry.id !== id);
			if (next.length === prev.length) return prev;
			revRef.current++;
			return next;
		});
	}, []);
	const activate = useCallback((id) => {
		revRef.current++;
		setInstalled((prev) => prev.map((r) => r.entry.id === id && !r.active ? {
			...r,
			active: true
		} : r));
	}, []);
	const deactivate = useCallback((id) => {
		revRef.current++;
		setInstalled((prev) => prev.map((r) => r.entry.id === id && r.active ? {
			...r,
			active: false
		} : r));
	}, []);
	const toggleActive = useCallback((id) => {
		revRef.current++;
		setInstalled((prev) => prev.map((r) => r.entry.id === id ? {
			...r,
			active: !r.active
		} : r));
	}, []);
	const activeInstances = useMemo(() => {
		return installed.filter((r) => r.active).map((r) => r.entry.factory());
	}, [installed, revRef.current]);
	const snapshot = useMemo(() => ({
		available: availablePlugins,
		installed,
		install,
		uninstall,
		activate,
		deactivate,
		toggleActive,
		activeInstances
	}), [
		installed,
		install,
		uninstall,
		activate,
		deactivate,
		toggleActive,
		activeInstances
	]);
	return /* @__PURE__ */ jsx(PluginRegistryContext.Provider, {
		value: snapshot,
		children
	});
}
/**
* Access the plugin registry from any component within a
* `<PluginRegistryProvider>`. Returns the full registry snapshot including
* `activeInstances` which can be spread into an `<AudioPlayer>`.
*/
function usePluginRegistry() {
	const ctx = useContext(PluginRegistryContext);
	if (ctx === null) throw new Error("usePluginRegistry must be used within a <PluginRegistryProvider>");
	return ctx;
}
/**
* Returns the current `activeInstances` array from the registry.
* This is a thin wrapper around `usePluginRegistry()` for convenience.
*/
function useActivePluginInstances() {
	const { activeInstances } = usePluginRegistry();
	const prev = useRef(activeInstances);
	const [stable, setStable] = useState(activeInstances);
	useEffect(() => {
		const a = prev.current;
		const b = activeInstances;
		if (a.length !== b.length || a.some((plugin, i) => plugin !== b[i])) {
			prev.current = b;
			setStable(b);
		}
	}, [activeInstances]);
	return stable;
}
//#endregion
//#region src/audio-player/plugins/registry/PluginManagerPanel.tsx
/**
* A plugin registry UI panel that lets users browse available plugins,
* install/uninstall them, and toggle active/inactive state.
*
* Designed to be rendered inside a `<PluginRegistryProvider>`.
*/
function PluginManagerPanel() {
	const { available, installed, install, uninstall, toggleActive, activeInstances } = usePluginRegistry();
	const installedIds = new Set(installed.map((r) => r.entry.id));
	const availableButNotInstalled = available.filter((e) => !installedIds.has(e.id));
	return /* @__PURE__ */ jsxs("div", {
		className: "lab-plugin-manager",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "lab-plugin-manager__head",
			children: [/* @__PURE__ */ jsx("span", {
				className: "lab-plugin-manager__title",
				children: "Plugin Registry"
			}), /* @__PURE__ */ jsxs("span", {
				className: "lab-plugin-manager__badge",
				children: [
					activeInstances.length,
					" / ",
					installed.length,
					" active"
				]
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "lab-plugin-manager__body",
			children: [/* @__PURE__ */ jsx(PluginListSection, {
				title: "Available",
				count: availableButNotInstalled.length,
				emptyLabel: "All plugins are installed.",
				children: availableButNotInstalled.map((entry) => /* @__PURE__ */ jsx(PluginCard, {
					entry,
					action: /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "lab-plugin-card__btn lab-plugin-card__btn--install",
						onClick: () => install(entry.id),
						"aria-label": `Install ${entry.label}`,
						children: "Install"
					})
				}, entry.id))
			}), /* @__PURE__ */ jsx(PluginListSection, {
				title: "Installed",
				count: installed.length,
				emptyLabel: "No plugins installed yet.",
				children: installed.map((record) => {
					const active = record.active;
					return /* @__PURE__ */ jsx(PluginCard, {
						entry: record.entry,
						active,
						action: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							className: `lab-plugin-card__btn${active ? " lab-plugin-card__btn--active" : " lab-plugin-card__btn--inactive"}`,
							onClick: () => toggleActive(record.entry.id),
							"aria-label": `${active ? "Deactivate" : "Activate"} ${record.entry.label}`,
							children: active ? "Active" : "Inactive"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "lab-plugin-card__btn lab-plugin-card__btn--uninstall",
							onClick: () => uninstall(record.entry.id),
							"aria-label": `Uninstall ${record.entry.label}`,
							children: "×"
						})] })
					}, record.entry.id);
				})
			})]
		})]
	});
}
function PluginListSection({ title, count, emptyLabel, children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "lab-plugin-manager__section",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "lab-plugin-manager__section-head",
			children: [/* @__PURE__ */ jsx("span", {
				className: "lab-plugin-manager__section-title",
				children: title
			}), /* @__PURE__ */ jsx("span", {
				className: "lab-plugin-manager__section-count",
				children: count
			})]
		}), count === 0 ? /* @__PURE__ */ jsx("p", {
			className: "lab-plugin-manager__empty",
			children: emptyLabel
		}) : /* @__PURE__ */ jsx("div", {
			className: "lab-plugin-manager__list",
			children
		})]
	});
}
function PluginCard({ entry, active, action }) {
	return /* @__PURE__ */ jsxs("div", {
		className: `lab-plugin-card${active ? " lab-plugin-card--active" : ""}`,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "lab-plugin-card__body",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "lab-plugin-card__head",
				children: [/* @__PURE__ */ jsx("span", {
					className: "lab-plugin-card__label",
					children: entry.label
				}), entry.category && /* @__PURE__ */ jsx("span", {
					className: "lab-plugin-card__category",
					children: entry.category
				})]
			}), /* @__PURE__ */ jsx("p", {
				className: "lab-plugin-card__desc",
				children: entry.description
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "lab-plugin-card__actions",
			children: action
		})]
	});
}
//#endregion
//#region src/audio-player/diagnostics/ActivityLogProvider.tsx
/**
* ActivityLogProvider — React context provider for the Activity Log.
*
* Mount this near the root of your player tree to make the Activity Log
* available through `useActivityLog()`. The provider creates a single store
* at mount time that lasts the lifetime of the component; it clears on
* unmount (provider is torn down) but NOT on session reset unless you
* manually call `clear()`.
*
* Usage:
* ```tsx
* <ActivityLogProvider>
*   <AudioSessionProvider>
*     <App />
*   </AudioSessionProvider>
* </ActivityLogProvider>
* ```
*/
function ActivityLogProvider({ children, config }) {
	const storeRef = useRef(null);
	if (storeRef.current === null) storeRef.current = createActivityLogStore(config);
	const api = useMemo(() => storeRef.current, []);
	return /* @__PURE__ */ jsx(ActivityLogContext.Provider, {
		value: api,
		children
	});
}
//#endregion
//#region src/audio-player/diagnostics/useActivityLogRecording.ts
/**
* useActivityLogRecording — wires lifecycle recording into an activity log
* context. Designed to be used inside AudioSessionProvider (or any other
* component that wants to automatically log player lifecycle events).
*
* Records events for:
* - Play/pause transitions
* - Track changes
* - Errors
* - Volume changes above threshold
* - Session lifecycle (queue changes, repeat/shuffle toggles)
*
* Usage:
* ```tsx
* useActivityLogRecording(engine, currentTrack, repeatMode, shuffle)
* ```
*
* This is fully optional — the activity log works without it, and callers
* can always record manually with `log.record(...)`.
*/
/**
* Automatically records common lifecycle events to the activity log. Safe to
* call from any component; does nothing if no ActivityLogProvider is mounted.
*
* Designed for use inside AudioSessionProvider or a skin component.
*/
function useActivityLogRecording({ engine, currentTrack, repeatMode, shuffle, trackLabel }) {
	const log = useOptionalActivityLog();
	const prevPlayingRef = useRef(engine.isPlaying);
	const prevTrackKeyRef = useRef(null);
	const prevVolumeRef = useRef(engine.volume);
	const prevMutedRef = useRef(engine.isMuted);
	useEffect(() => {
		if (!log) return;
		if (prevPlayingRef.current === engine.isPlaying) return;
		prevPlayingRef.current = engine.isPlaying;
		if (engine.isPlaying) log.record({
			area: "playback",
			status: "info",
			message: trackLabel ? `Playback started — ${trackLabel}` : "Playback started",
			details: currentTrack ? {
				title: currentTrack.title,
				artist: currentTrack.artist
			} : void 0
		});
		else log.record({
			area: "playback",
			status: "info",
			message: "Playback paused"
		});
	}, [
		engine.isPlaying,
		log,
		currentTrack,
		trackLabel
	]);
	useEffect(() => {
		if (!log || !currentTrack) return;
		const key = currentTrack.id ?? `${currentTrack.title}:${currentTrack.artist}`;
		if (prevTrackKeyRef.current === key) return;
		prevTrackKeyRef.current = key;
		log.record({
			area: "playback",
			status: "info",
			message: `Now playing: ${currentTrack.title}`,
			details: {
				title: currentTrack.title,
				artist: currentTrack.artist,
				duration: engine.duration
			}
		});
	}, [
		currentTrack,
		engine.duration,
		log
	]);
	useEffect(() => {
		if (!log || !engine.hasError) return;
		log.record({
			area: "playback",
			status: "error",
			message: engine.errorMessage || "Playback error",
			details: currentTrack ? {
				title: currentTrack.title,
				artist: currentTrack.artist
			} : void 0
		});
	}, [
		engine.hasError,
		engine.errorMessage,
		log,
		currentTrack
	]);
	useEffect(() => {
		if (!log) return;
		const prevVol = prevVolumeRef.current;
		const prevMuted = prevMutedRef.current;
		prevVolumeRef.current = engine.volume;
		prevMutedRef.current = engine.isMuted;
		if (engine.isMuted && !prevMuted) log.record({
			area: "playback",
			status: "warn",
			message: "Audio muted"
		});
		else if (!engine.isMuted && prevMuted) log.record({
			area: "playback",
			status: "info",
			message: `Audio unmuted — volume ${Math.round(engine.volume * 100)}%`
		});
		else if (!engine.isMuted) {
			if (Math.abs(engine.volume - prevVol) > .05) log.record({
				area: "playback",
				status: "info",
				message: `Volume changed to ${Math.round(engine.volume * 100)}%`
			});
		}
	}, [
		engine.volume,
		engine.isMuted,
		log
	]);
	const prevRepeatRef = useRef(repeatMode);
	const prevShuffleRef = useRef(shuffle);
	useEffect(() => {
		if (!log) return;
		if (prevRepeatRef.current !== repeatMode) {
			prevRepeatRef.current = repeatMode;
			log.record({
				area: "session",
				status: "info",
				message: `Repeat mode: ${repeatMode}`
			});
		}
	}, [repeatMode, log]);
	useEffect(() => {
		if (!log) return;
		if (prevShuffleRef.current !== shuffle) {
			prevShuffleRef.current = shuffle;
			log.record({
				area: "session",
				status: "info",
				message: shuffle ? "Shuffle enabled" : "Shuffle disabled"
			});
		}
	}, [shuffle, log]);
}
//#endregion
//#region src/audio-player/plugins/surfaces/pluginSurfaceHelpers.ts
/** True when the plugin exposes a (enabled) settings surface. */
function hasSettingsSurface(definition) {
	if (definition.kind !== "settings" && definition.kind !== "dual") return false;
	return definition.settings?.enabled === true;
}
/** True when the plugin exposes a (enabled) SEI Canvas surface. */
function hasCanvasSurface(definition) {
	if (definition.kind !== "canvas" && definition.kind !== "dual") return false;
	return definition.canvas?.enabled === true;
}
/** True when the plugin renders no UI at all. */
function isHeadlessPlugin(definition) {
	return definition.kind === "headless";
}
/** The declarative settings route, when the plugin has an enabled settings surface. */
function getPluginSettingsRoute(definition) {
	return hasSettingsSurface(definition) ? definition.settings?.route : void 0;
}
/** The SEI Canvas surface id, when the plugin has an enabled canvas surface. */
function getPluginCanvasSurfaceId(definition) {
	return hasCanvasSurface(definition) ? definition.canvas?.surfaceId : void 0;
}
/**
* Return a new array sorted by menu order (ascending), tie-broken by pluginId.
* Stable and non-mutating — the input array is left untouched.
*/
function sortPluginSurfaceDefinitions(definitions) {
	return [...definitions].sort((a, b) => {
		const orderA = a.menu?.order ?? Number.MAX_SAFE_INTEGER;
		const orderB = b.menu?.order ?? Number.MAX_SAFE_INTEGER;
		if (orderA !== orderB) return orderA - orderB;
		return a.pluginId.localeCompare(b.pluginId);
	});
}
//#endregion
//#region src/audio-player/plugins/surfaces/defaultPluginSurfaces.ts
var DEFAULT_PLUGIN_SURFACES = [
	{
		pluginId: "keyboard-shortcuts",
		label: "Keyboard Shortcuts",
		description: "Space / arrow / JKL transport controls.",
		category: "utility",
		kind: "headless"
	},
	{
		pluginId: "analytics",
		label: "Analytics",
		description: "Playback event reporting.",
		category: "analytics",
		kind: "settings",
		settings: {
			enabled: true,
			route: "plugin-settings:analytics",
			label: "Analytics"
		},
		menu: {
			branch: "plugin:analytics",
			order: 40
		}
	},
	{
		pluginId: "lyrics",
		label: "Lyrics",
		description: "Synced lyrics — primary UI lives in SEI Canvas.",
		category: "visual",
		kind: "dual",
		settings: {
			enabled: true,
			route: "plugin-settings:lyrics",
			label: "Lyrics"
		},
		canvas: {
			enabled: true,
			surfaceId: "lyrics",
			label: "Lyrics",
			requiresActiveTrack: true,
			preferredHeight: "standard"
		},
		menu: {
			showInArc: true,
			branch: "plugin:visual",
			order: 10
		}
	},
	{
		pluginId: "sleep-timer",
		label: "Sleep Timer",
		description: "Auto-stop after a chosen duration.",
		category: "utility",
		kind: "settings",
		settings: {
			enabled: true,
			route: "plugin-settings:sleep-timer",
			label: "Sleep Timer"
		},
		menu: {
			branch: "playback",
			order: 30
		}
	},
	{
		pluginId: "automix",
		label: "Automix",
		description: "Beat-aware crossfades between tracks.",
		category: "playback",
		kind: "settings",
		settings: {
			enabled: true,
			route: "playback:automix",
			label: "Automix"
		},
		menu: {
			branch: "playback",
			order: 20
		}
	},
	{
		pluginId: "auto-theme",
		label: "Auto Theme",
		description: "Derives player colors from album art.",
		category: "visual",
		kind: "settings",
		settings: {
			enabled: true,
			route: "plugin-settings:auto-theme",
			label: "Auto Theme"
		},
		menu: {
			branch: "plugin:visual",
			order: 50
		}
	},
	{
		pluginId: "waveform",
		label: "Waveform",
		description: "Interactive waveform scrubber (no SEI Canvas surface yet).",
		category: "visual",
		kind: "settings",
		settings: {
			enabled: true,
			route: "plugin-settings:waveform",
			label: "Waveform"
		},
		menu: {
			branch: "plugin:visual",
			order: 60
		}
	}
];
/** Look up a single plugin's surface definition by its plugin id. */
function getPluginSurfaceDefinition(pluginId) {
	return DEFAULT_PLUGIN_SURFACES.find((def) => def.pluginId === pluginId);
}
/** All surface definitions in a given category, sorted by menu order. */
function getPluginSurfaceDefinitionsByCategory(category) {
	return sortPluginSurfaceDefinitions(DEFAULT_PLUGIN_SURFACES.filter((def) => def.category === category));
}
/** All surface definitions whose menu placement targets a given branch, sorted. */
function getPluginSurfaceDefinitionsForMenuBranch(branch) {
	return sortPluginSurfaceDefinitions(DEFAULT_PLUGIN_SURFACES.filter((def) => def.menu?.branch === branch));
}
//#endregion
//#region src/audio-player/properties/propertyRegistry.ts
/**
* The shared property model. Every editable property is declared here exactly
* once with its group, control, default, and per-face applicability. Faces and
* the Properties panel both read this registry, so a property added here becomes
* available everywhere a face opts into it — no per-face wiring.
*
* Defaults mirror the historical in-code defaults (the SEI theme + OG typography
* the workshop has always shipped) so nothing shifts when the panel switches to
* reading this registry.
*/
var TITLE_FONT_DEFAULT = {
	fontSize: "24px",
	fontWeight: 600,
	letterSpacing: "-0.02em",
	lineHeight: "1.2em"
};
var ARTIST_FONT_DEFAULT = {
	fontSize: "15px",
	fontWeight: 500,
	letterSpacing: "-0.01em",
	lineHeight: "1.3em"
};
/** Faces that render a full-bleed background layer. */
var BACKGROUND_FACES = ["portable", "fullCard"];
/** Faces that render a dedicated artwork/cover block. */
var ART_FACES = [
	"fullCard",
	"seaCard",
	"miniSidebar"
];
/** Major full-size faces sharing the core typography + media property set. */
var MAJOR_FACES = [
	"portable",
	"fullCard",
	"seaCard"
];
/** Faces that surface a volume control. */
var VOLUME_FACES = [
	"portable",
	"fullCard",
	"stickyBottom"
];
var PROPERTY_GROUPS = [
	"content",
	"appearance",
	"playback",
	"advanced"
];
/** Human labels for the four sections, used by the panel headers. */
var PROPERTY_GROUP_LABELS = {
	content: "Content",
	appearance: "Appearance",
	playback: "Playback",
	advanced: "Advanced"
};
var PROPERTY_REGISTRY = [
	{
		id: "backgroundMedia",
		label: "Background",
		description: "Full-bleed image or video behind the player.",
		group: "content",
		control: {
			kind: "media",
			role: "background"
		},
		propPath: "backgroundMedia",
		default: null,
		faces: BACKGROUND_FACES
	},
	{
		id: "artMedia",
		label: "Cover Art",
		description: "Image or video shown in the artwork block.",
		group: "content",
		control: {
			kind: "media",
			role: "art"
		},
		propPath: "artMedia",
		default: null,
		faces: ART_FACES
	},
	{
		id: "accentColor",
		label: "Button Color",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.accentColor",
		default: "#7C5CFF"
	},
	{
		id: "playIconColor",
		label: "Play Icon",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.playIconColor",
		default: "#0b0b12"
	},
	{
		id: "textColor",
		label: "Text",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.textColor",
		default: "#FFFFFF"
	},
	{
		id: "progressColor",
		label: "Progress",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.progressColor",
		default: "#7C5CFF"
	},
	{
		id: "trackColor",
		label: "Track",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.trackColor",
		default: "rgba(124,92,255,0.25)"
	},
	{
		id: "backgroundColor",
		label: "Surface",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.backgroundColor",
		default: "rgba(20,20,28,0.6)"
	},
	{
		id: "glowColor",
		label: "Glow Color",
		description: "Ambient glow color around the player root. Transparent disables it.",
		group: "appearance",
		control: { kind: "color" },
		propPath: "theme.glowColor",
		default: "transparent"
	},
	{
		id: "glowIntensity",
		label: "Glow",
		description: "Ambient glow strength. 0 turns the glow off regardless of Glow Color.",
		group: "appearance",
		control: {
			kind: "range",
			min: 0,
			max: 150,
			step: 5,
			unit: "%"
		},
		propPath: "theme.glowIntensity",
		default: 100
	},
	{
		id: "buttonOpacity",
		label: "Button Fill",
		description: "Translucency of button fills — lower is more see-through, higher is more solid.",
		group: "appearance",
		control: {
			kind: "range",
			min: -20,
			max: 40,
			step: 1,
			unit: "%"
		},
		propPath: "theme.buttonOpacity",
		default: 0
	},
	{
		id: "blurSize",
		label: "Blur",
		group: "appearance",
		control: {
			kind: "range",
			min: 0,
			max: 50,
			step: 1,
			unit: "px"
		},
		propPath: "blurSize",
		default: 20,
		faces: BACKGROUND_FACES
	},
	{
		id: "darkenAmount",
		label: "Darken",
		group: "appearance",
		control: {
			kind: "range",
			min: 0,
			max: 100,
			step: 1,
			unit: "%"
		},
		propPath: "darkenAmount",
		default: 45,
		faces: BACKGROUND_FACES
	},
	{
		id: "titleFont",
		label: "Title Font",
		group: "appearance",
		control: { kind: "font" },
		propPath: "titleFont",
		default: { ...TITLE_FONT_DEFAULT },
		faces: MAJOR_FACES
	},
	{
		id: "artistFont",
		label: "Artist Font",
		group: "appearance",
		control: { kind: "font" },
		propPath: "artistFont",
		default: { ...ARTIST_FONT_DEFAULT },
		faces: MAJOR_FACES
	},
	{
		id: "autoPlay",
		label: "Auto Play",
		group: "playback",
		control: { kind: "toggle" },
		propPath: "autoPlay",
		default: false
	},
	{
		id: "shuffle",
		label: "Shuffle",
		group: "playback",
		control: { kind: "toggle" },
		propPath: "shuffle",
		default: false
	},
	{
		id: "repeatMode",
		label: "Repeat",
		group: "playback",
		control: {
			kind: "select",
			options: [
				{
					value: "off",
					label: "Off"
				},
				{
					value: "all",
					label: "All"
				},
				{
					value: "one",
					label: "One"
				}
			]
		},
		propPath: "repeatMode",
		default: "off"
	},
	{
		id: "showVolume",
		label: "Show Volume",
		group: "playback",
		control: { kind: "toggle" },
		propPath: "showVolume",
		default: true,
		faces: VOLUME_FACES
	},
	{
		id: "showTracklist",
		label: "Show Tracklist",
		group: "playback",
		control: { kind: "toggle" },
		propPath: "showTracklist",
		default: true,
		faces: ["portable"]
	},
	{
		id: "showWaveform",
		label: "Show Waveform",
		group: "playback",
		control: { kind: "toggle" },
		propPath: "showWaveform",
		default: false,
		faces: ["portable"]
	},
	{
		id: "artCss",
		label: "Art (CSS)",
		description: "Raw CSS background-image escape hatch (gradient or url).",
		group: "advanced",
		control: {
			kind: "text",
			placeholder: "url(\"…\") or linear-gradient(…)"
		},
		propPath: "art",
		default: "",
		faces: ART_FACES
	}
];
/** All properties a face exposes, in registry order. */
function getPropertiesForFace(face) {
	return PROPERTY_REGISTRY.filter((d) => !d.faces || d.faces.includes(face));
}
/** A face's properties within a single section. */
function getPropertiesForGroup(face, group) {
	return getPropertiesForFace(face).filter((d) => d.group === group);
}
/** Set a value at a dotted `propPath`, returning a new object (immutable). */
function setByPropPath(target, propPath, value) {
	const keys = propPath.split(".");
	const next = { ...target };
	let cursor = next;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (key === "__proto__" || key === "constructor" || key === "prototype") return next;
		cursor[key] = { ...cursor[key] };
		cursor = cursor[key];
	}
	const lastKey = keys[keys.length - 1];
	if (lastKey === "__proto__" || lastKey === "constructor" || lastKey === "prototype") return next;
	cursor[lastKey] = value;
	return next;
}
/** Read a value at a dotted `propPath`. */
function getByPropPath(target, propPath) {
	return propPath.split(".").reduce((acc, key) => acc == null ? void 0 : acc[key], target);
}
/**
* A nested defaults object built from every descriptor's `default`, keyed by
* `propPath`. Consumers (e.g. the workshop) spread this to seed their settings
* so editor defaults always track the registry.
*/
function getPropertyDefaults() {
	let acc = {};
	for (const d of PROPERTY_REGISTRY) acc = setByPropPath(acc, d.propPath, d.default);
	return acc;
}
//#endregion
export { ARC_RADIUS, AUTOMIX_FADE_MS, ActivityLogContext, ActivityLogPanel, ActivityLogProvider, ActivityLogWorkspace, AgentQueueDirectorWorkspace, AnalyticsPlugin, ArcActionButton, AudioPlayer, AudioPlayer as default, AudioSessionProvider, AudioSpriteEngine, AutoThemePlugin, AutomixPlugin, BUILTIN_VISUAL_COMPONENTS, BackgroundMedia, ControllerPanelRenderer, CueManifestPlugin, CueRuntime, DEFAULT_ACTIVITY_LOG_CONFIG, DEFAULT_PLUGIN_SURFACES, DefaultPluginErrorHandler, ExplicitBadge, FAMILY_DEFAULTS, FullCardPlayer, GracefulDegradation, HTML5AudioBackend, INITIAL_SURFACE_STATE, KeyboardShortcutPlugin, LYRIC_DISPLAY_ID, LibraryPlaylistsWorkspace, LibraryQueueWorkspace, LyricDisplay, LyricSettingsPanel, LyricsPlugin, MAJOR_FACES, MiniSidebarPlayer, NarrativeFace, PLAYER_FACE_CAPABILITIES, PROPERTY_GROUPS, PROPERTY_GROUP_LABELS, PROPERTY_REGISTRY, PRO_CONFIDENCE_MIN, PlaybackAutomixWorkspace, PlayerHero, PlayerSurfaceButtons, PluginError, PluginErrorBoundary, PluginErrorBoundaryFactory, PluginManager, PluginManagerPanel, PluginRegistryProvider, PluginSettingsWorkspace, ProgressBar, QueueDrawer, QueueSurface, SAPController, SCENE_FADE_MS, SEICanvasActionMenu, SEICanvasHost, SEICanvasRenderer, SceneMixEngine, ScrubberCanvasHost, ScrubberCanvasRenderer, SeaCardPlayer, SleepTimerPlugin, StickyBottomPlayer, SurfaceButton, TextMarquee, TrackMetadata, VAULT_CATEGORY_META, VaultRowPlayer, VisualLyricsWorkspace, VisualSlotPicker, VisualSlotsProvider, VolumeControl, WORKSPACE_ROUTES, WaveformAdapter, WaveformPlugin, WaveformProgress, WebAudioBackend, WorkspaceShell, arcOffsets, bpmCompatibility, buildMenuTree, canEnterCanvas, checkCodecSupport, clearCustomCategories, composeEventHandlers, computePeaksFromUrl, computeTransitionPoints, contrastText, createActivityLogStore, createAnalyticsPlugin, createAudioBackend, createAudioSpriteEngine, createAutoThemePlugin, createAutomixPlugin, createCueManifestPlugin, createKeyboardShortcutPlugin, createLyricsPlugin, createPluginErrorBoundary, createSceneMixEngine, createSleepTimerPlugin, createWaveformPlugin, defaultShowVolume, deriveHeroCollapsed, deserializeSession, ensureMuted, ensureProTrackAnalysis, ensureTrackAnalysis, extractPalette, extractPeaks, faceSupportsAction, faceSupportsContextualActions, faceSupportsHeroCollapse, faceSupportsSEICanvas, faceSupportsScrubberCanvas, faceSupportsWaveform, formatFeatured, formatSecondaryLine, formatTime, formatVersionedTitle, getAllVaultCategories, getAllVisualComponents, getByPropPath, getDefaultComponentForSlot, getDisplayArtist, getDisplayTitle, getFaceCapability, getFaceFamily, getGlobalErrorBoundaryFactory, getPluginCanvasSurfaceId, getPluginSettingsRoute, getPluginSurfaceDefinition, getPluginSurfaceDefinitionsByCategory, getPluginSurfaceDefinitionsForMenuBranch, getPreferredCanvasPlacement, getPrimaryTrackSource, getPropertiesForFace, getPropertiesForGroup, getPropertyDefaults, getScrubberDensity, getScrubberHeight, getTrackAnalysis, getTrackSources, getTrackTrims, getVaultCategoryMeta, getVisualComponent, getVisualComponentsForSlot, gradient, hasCanvasSurface, hasSettingsSurface, isHeadlessPlugin, isIOS, isMobileDevice, isNodeInteractive, isPluginError, isSAPDefaultPrevented, isSessionEngine, isWorkspaceRoute, lyricDefaultSettings, lyricDisplayDefinition, mergeRefs, normalizeRhythmConfidence, parseWorkspaceRoute, planTransition, quantizePixels, registerVaultCategory, registerVisualComponent, relativeLuminance, resolveMedia, rgbToCss, serializeSession, setByPropPath, setGlobalErrorHandler, shouldEnableMarquee, snapToBeat, sortPluginSurfaceDefinitions, surfaceReducer, trackKey, trackSourcesSignature, useActivePluginInstances, useActivityLog, useActivityLogRecording, useAudioPlayer, useAudioSession, useAutomix, useMediaSessionObserver, useNarrativeAudio, useNarrativeCueController, usePlayerSurface, usePluginManager, usePluginRegistry, useReducedMotion, useSAPPropGetters, useShareTrack, useVisualSlots, validateCueManifest, validateTrackSource, withErrorBoundary };

//# sourceMappingURL=index.js.map