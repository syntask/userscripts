// ==UserScript==
// @name         Vectorizer.AI Free Download
// @namespace    https://vectorizer.ai/
// @version      1.1.0
// @author       Syntask
// @description  Bypass paywall by downloading SVGs directly from Vectorizer.AI's native vector websocket payloads.
// @downloadURL  https://raw.githubusercontent.com/syntask/userscripts/main/vectorizer-ai.user.js
// @updateURL    https://raw.githubusercontent.com/syntask/userscripts/main/vectorizer-ai.user.js
// @match        https://vectorizer.ai/images*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PAGE_FLAG = '__vectorizerSvgTapInstalled';
  const REQUEST_EVENT = 'vectorizer-svg-download-request';
  const RESULT_EVENT = 'vectorizer-svg-download-result';
  const DOWNLOAD_LINK_ID = 'App-DownloadLink';
  const DOWNLOAD_TEXT_SELECTOR_A = '#App-DownloadLink span span.showFree';
  const DOWNLOAD_TEXT_SELECTOR_B = '#App-DownloadLink span span.showPaid';
  const DOWNLOAD_TEXT = 'Download 🏴‍☠️';

  const injectedSource = String.raw`
    (() => {
      if (window.${PAGE_FLAG}) {
        return;
      }
      window.${PAGE_FLAG} = true;

      const TAU = Math.PI * 2;
      const tap = {
        native: {
          latest: null,
        },
      };
      window.__vectorizerSvgTap = tap;

      const fmt = (value) => {
        const number = Math.abs(value) < 1e-9 ? 0 : value;
        return Number(number.toFixed(4)).toString();
      };

      const escapeXml = (text) => String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const argbToRgba = (value) => {
        const int = value >>> 0;
        return {
          red: (int >>> 16) & 255,
          green: (int >>> 8) & 255,
          blue: int & 255,
          alpha: ((int >>> 24) & 255) / 255,
        };
      };

      const rgbaToCss = (rgba) => {
        if (rgba.alpha >= 0.999) {
          return 'rgb(' + rgba.red + ',' + rgba.green + ',' + rgba.blue + ')';
        }
        return 'rgba(' + rgba.red + ',' + rgba.green + ',' + rgba.blue + ',' + fmt(rgba.alpha) + ')';
      };

      class Reader {
        constructor(buffer) {
          this.view = new DataView(buffer);
          this.offset = 0;
        }

        readInt8() {
          const value = this.view.getInt8(this.offset);
          this.offset += 1;
          return value;
        }

        readBoolean() {
          return this.readInt8() !== 0;
        }

        readInt32() {
          const value = this.view.getInt32(this.offset, false);
          this.offset += 4;
          return value;
        }

        readFloat32() {
          const value = this.view.getFloat32(this.offset, false);
          this.offset += 4;
          return value;
        }
      }

      const readCurve = (reader) => {
        const type = reader.readInt8();
        switch (type) {
          case 0:
            return {
              type,
              startX: reader.readFloat32(),
              startY: reader.readFloat32(),
              endX: reader.readFloat32(),
              endY: reader.readFloat32(),
            };
          case 1:
            return {
              type,
              startX: reader.readFloat32(),
              startY: reader.readFloat32(),
              controlX: reader.readFloat32(),
              controlY: reader.readFloat32(),
              endX: reader.readFloat32(),
              endY: reader.readFloat32(),
            };
          case 2:
            return {
              type,
              startX: reader.readFloat32(),
              startY: reader.readFloat32(),
              controlStartX: reader.readFloat32(),
              controlStartY: reader.readFloat32(),
              controlEndX: reader.readFloat32(),
              controlEndY: reader.readFloat32(),
              endX: reader.readFloat32(),
              endY: reader.readFloat32(),
            };
          case 3:
          case 4: {
            const isLargeArc = reader.readBoolean();
            const isClockwise = reader.readBoolean();
            const startX = reader.readFloat32();
            const startY = reader.readFloat32();
            const centerX = reader.readFloat32();
            const centerY = reader.readFloat32();
            const radius = reader.readFloat32();
            const thetaStartRad = reader.readFloat32();
            const deltaThetaRad = reader.readFloat32();
            const endX = reader.readFloat32();
            const endY = reader.readFloat32();
            return {
              type,
              isLargeArc,
              isClockwise,
              startX,
              startY,
              centerX,
              centerY,
              radiusX: radius,
              radiusY: radius,
              rotationRad: 0,
              rotationDeg: 0,
              thetaStartRad,
              deltaThetaRad,
              endX,
              endY,
            };
          }
          case 5:
          case 6: {
            const isLargeArc = reader.readBoolean();
            const isClockwise = reader.readBoolean();
            const startX = reader.readFloat32();
            const startY = reader.readFloat32();
            const centerX = reader.readFloat32();
            const centerY = reader.readFloat32();
            const radiusX = reader.readFloat32();
            const radiusY = reader.readFloat32();
            const rotationRad = reader.readFloat32();
            const thetaStartRad = reader.readFloat32();
            const deltaThetaRad = reader.readFloat32();
            const endX = reader.readFloat32();
            const endY = reader.readFloat32();
            return {
              type,
              isLargeArc,
              isClockwise,
              startX,
              startY,
              centerX,
              centerY,
              radiusX,
              radiusY,
              rotationRad,
              rotationDeg: rotationRad * 180 / Math.PI,
              thetaStartRad,
              deltaThetaRad,
              endX,
              endY,
            };
          }
          default:
            throw new Error('Unknown native curve type: ' + type);
        }
      };

      const readCurveArray = (reader) => {
        const count = reader.readInt32();
        const curves = [];
        for (let index = 0; index < count; index += 1) {
          curves.push(readCurve(reader));
        }
        return curves;
      };

      const readShape = (reader) => ({
        index: reader.readInt32(),
        parentLoopIndex: reader.readInt32(),
        paletteIndex: reader.readInt32(),
        vectorLoops: [],
        vectorLoopsToDraw: [],
        hasNonOpaqueDescendents: false,
      });

      const readLoop = (reader) => ({
        type: reader.readInt8(),
        index: reader.readInt32(),
        vectorShapeIndex: reader.readInt32(),
        isPositive: reader.readBoolean(),
        curves: readCurveArray(reader),
        childShapes: [],
        vectorInterfaces: [],
        vectorInterfacesToDraw: [],
        hasNonOpaqueDescendents: false,
      });

      const readInterface = (reader) => ({
        parentVectorLoopIndex: reader.readInt32(),
        vectorLoopIndex0: reader.readInt32(),
        vectorLoopIndex1: reader.readInt32(),
        argbInt: reader.readInt32(),
        curves: readCurveArray(reader),
      });

      const parseChunk = (buffer) => {
        const reader = new Reader(buffer);
        const shapeCount = reader.readInt32();
        const shapes = [];
        for (let index = 0; index < shapeCount; index += 1) {
          shapes.push(readShape(reader));
        }

        const loopCount = reader.readInt32();
        const loops = [];
        for (let index = 0; index < loopCount; index += 1) {
          loops.push(readLoop(reader));
        }

        const interfaceCount = reader.readInt32();
        const interfaces = [];
        for (let index = 0; index < interfaceCount; index += 1) {
          interfaces.push(readInterface(reader));
        }

        return { shapes, loops, interfaces };
      };

      const fullArcSegments = (curve) => {
        const midTheta = curve.thetaStartRad + (curve.deltaThetaRad || 0) / 2;
        const cosRot = Math.cos(curve.rotationRad || 0);
        const sinRot = Math.sin(curve.rotationRad || 0);
        const cosMid = Math.cos(midTheta);
        const sinMid = Math.sin(midTheta);
        const midX = curve.centerX + cosRot * curve.radiusX * cosMid - sinRot * curve.radiusY * sinMid;
        const midY = curve.centerY + sinRot * curve.radiusX * cosMid + cosRot * curve.radiusY * sinMid;
        const sweep = curve.isClockwise ? 1 : 0;
        const rotation = curve.rotationDeg || 0;

        return [
          'A ' + fmt(curve.radiusX) + ' ' + fmt(curve.radiusY) + ' ' + fmt(rotation) + ' 0 ' + sweep + ' ' + fmt(midX) + ' ' + fmt(midY),
          'A ' + fmt(curve.radiusX) + ' ' + fmt(curve.radiusY) + ' ' + fmt(rotation) + ' 0 ' + sweep + ' ' + fmt(curve.endX) + ' ' + fmt(curve.endY),
        ];
      };

      const arcSegments = (curve) => {
        const isFullArc = Math.abs(Math.abs(curve.deltaThetaRad || 0) - TAU) < 1e-4 ||
          (Math.abs(curve.startX - curve.endX) < 1e-4 && Math.abs(curve.startY - curve.endY) < 1e-4);
        if (isFullArc) {
          return fullArcSegments(curve);
        }
        return [
          'A ' +
            fmt(curve.radiusX) + ' ' + fmt(curve.radiusY) + ' ' + fmt(curve.rotationDeg || 0) + ' ' +
            (curve.isLargeArc ? 1 : 0) + ' ' + (curve.isClockwise ? 1 : 0) + ' ' +
            fmt(curve.endX) + ' ' + fmt(curve.endY),
        ];
      };

      const curveToPathCommand = (curve) => {
        switch (curve.type) {
          case 0:
            return ['L ' + fmt(curve.endX) + ' ' + fmt(curve.endY)];
          case 1:
            return ['Q ' + fmt(curve.controlX) + ' ' + fmt(curve.controlY) + ' ' + fmt(curve.endX) + ' ' + fmt(curve.endY)];
          case 2:
            return [
              'C ' +
                fmt(curve.controlStartX) + ' ' + fmt(curve.controlStartY) + ' ' +
                fmt(curve.controlEndX) + ' ' + fmt(curve.controlEndY) + ' ' +
                fmt(curve.endX) + ' ' + fmt(curve.endY),
            ];
          case 3:
          case 4:
          case 5:
          case 6:
            return arcSegments(curve);
          default:
            throw new Error('Unsupported native curve type: ' + curve.type);
        }
      };

      const pathDataFromCurves = (curves, closePath) => {
        if (!curves || !curves.length) {
          return '';
        }
        const parts = ['M ' + fmt(curves[0].startX) + ' ' + fmt(curves[0].startY)];
        for (const curve of curves) {
          parts.push(...curveToPathCommand(curve));
        }
        if (closePath) {
          parts.push('Z');
        }
        return parts.join(' ');
      };

      const addBoundsPoint = (bounds, x, y) => {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      };

      const includeCurveBounds = (bounds, curve) => {
        addBoundsPoint(bounds, curve.startX, curve.startY);
        addBoundsPoint(bounds, curve.endX, curve.endY);
        if (curve.type === 1) {
          addBoundsPoint(bounds, curve.controlX, curve.controlY);
        } else if (curve.type === 2) {
          addBoundsPoint(bounds, curve.controlStartX, curve.controlStartY);
          addBoundsPoint(bounds, curve.controlEndX, curve.controlEndY);
        } else if (curve.type >= 3) {
          addBoundsPoint(bounds, curve.centerX - curve.radiusX, curve.centerY - curve.radiusY);
          addBoundsPoint(bounds, curve.centerX + curve.radiusX, curve.centerY + curve.radiusY);
        }
      };

      const guessViewBox = (parsed) => {
        const canvases = [
          document.getElementById('App-ImageView-RightCanvas'),
          document.getElementById('App-ImageView-LeftCanvas'),
        ].filter(Boolean);

        for (const canvas of canvases) {
          if (canvas.width > 0 && canvas.height > 0) {
            return [0, 0, canvas.width, canvas.height];
          }
        }

        const bounds = {
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
        };

        for (const loop of parsed.loops) {
          for (const curve of loop.curves) {
            includeCurveBounds(bounds, curve);
          }
        }

        if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
          return [0, 0, 1024, 1024];
        }

        const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX));
        const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY));
        return [Math.floor(bounds.minX), Math.floor(bounds.minY), width, height];
      };

      const parseNativeResult = () => {
        const job = tap.native.latest;
        if (!job || !job.start || !Array.isArray(job.chunks) || !job.chunks.length) {
          throw new Error('No native vector result has been captured yet. Reload the page after the userscript is installed, then try again.');
        }

        const parsed = {
          start: job.start,
          shapes: [],
          loops: [],
          interfaces: [],
        };

        for (const buffer of job.chunks) {
          const chunk = parseChunk(buffer);
          for (const shape of chunk.shapes) {
            parsed.shapes[shape.index] = shape;
          }
          for (const loop of chunk.loops) {
            parsed.loops[loop.index] = loop;
          }
          for (const vectorInterface of chunk.interfaces) {
            parsed.interfaces.push(vectorInterface);
          }
        }

        const shapes = parsed.shapes.filter(Boolean);
        const loops = parsed.loops.filter(Boolean);
        const colors = ((job.start.userPalette && job.start.userPalette.colors) || []).map((entry) => argbToRgba(entry.argb));

        const markShape = (shape) => {
          if (!shape || shape.hasNonOpaqueDescendents) {
            return;
          }
          shape.hasNonOpaqueDescendents = true;
          if (shape.parentLoop) {
            markLoop(shape.parentLoop);
          }
        };

        const markLoop = (loop) => {
          if (!loop || loop.hasNonOpaqueDescendents) {
            return;
          }
          loop.hasNonOpaqueDescendents = true;
          if (loop.vectorShape) {
            markShape(loop.vectorShape);
          }
        };

        for (const shape of shapes) {
          if (shape.parentLoopIndex >= 0) {
            shape.parentLoop = parsed.loops[shape.parentLoopIndex] || null;
            if (shape.parentLoop) {
              shape.parentLoop.childShapes.push(shape);
            }
          }
        }

        for (const loop of loops) {
          loop.vectorShape = parsed.shapes[loop.vectorShapeIndex] || null;
          if (loop.vectorShape) {
            loop.vectorShape.vectorLoops.push(loop);
          }
        }

        for (const shape of shapes) {
          const color = colors[shape.paletteIndex] || { red: 0, green: 0, blue: 0, alpha: 1 };
          shape.fillColor = color;
          if (color.alpha < 0.999) {
            markShape(shape);
          }
        }

        for (const vectorInterface of parsed.interfaces) {
          vectorInterface.parentVectorLoop = parsed.loops[vectorInterface.parentVectorLoopIndex] || null;
          vectorInterface.vectorLoop0 = parsed.loops[vectorInterface.vectorLoopIndex0] || null;
          vectorInterface.vectorLoop1 = parsed.loops[vectorInterface.vectorLoopIndex1] || null;
          vectorInterface.strokeColor = argbToRgba(vectorInterface.argbInt);
          vectorInterface.isSiblingInterface = Boolean(
            vectorInterface.vectorLoop0 &&
            vectorInterface.vectorLoop1 &&
            vectorInterface.vectorLoop0.isPositive &&
            vectorInterface.vectorLoop1.isPositive
          );
          vectorInterface.hasNonOpaqueDescendents = Boolean(
            vectorInterface.vectorLoop0 && vectorInterface.vectorLoop0.hasNonOpaqueDescendents
          ) || Boolean(
            vectorInterface.vectorLoop1 && vectorInterface.vectorLoop1.hasNonOpaqueDescendents
          );

          const color0 = vectorInterface.vectorLoop0 && vectorInterface.vectorLoop0.vectorShape
            ? vectorInterface.vectorLoop0.vectorShape.fillColor
            : { alpha: 0 };
          const color1 = vectorInterface.vectorLoop1 && vectorInterface.vectorLoop1.vectorShape
            ? vectorInterface.vectorLoop1.vectorShape.fillColor
            : { alpha: 0 };

          vectorInterface.shouldDraw = Boolean(
            (vectorInterface.isSiblingInterface || vectorInterface.hasNonOpaqueDescendents) &&
            (color0.alpha > 0.99 || color1.alpha > 0.99) &&
            color0.alpha > 0.01 &&
            color1.alpha > 0.01
          );

          if (vectorInterface.parentVectorLoop) {
            vectorInterface.parentVectorLoop.vectorInterfaces.push(vectorInterface);
          }
        }

        for (const shape of shapes) {
          shape.vectorLoopsToDraw = shape.vectorLoops.filter((loop) => loop.isPositive || loop.hasNonOpaqueDescendents);
        }

        for (const loop of loops) {
          loop.vectorInterfacesToDraw = loop.vectorInterfaces.filter((vectorInterface) => vectorInterface.shouldDraw);
        }

        parsed.shapeList = shapes;
        parsed.loops = loops;
        parsed.topShapes = shapes.filter((shape) => shape.parentLoopIndex < 0);
        return parsed;
      };

      const buildNativeSvg = () => {
        const parsed = parseNativeResult();
        const elements = [];

        for (const shape of parsed.topShapes) {
          const firstLoop = shape.vectorLoops[0];
          if (!firstLoop) {
            continue;
          }
          for (const vectorInterface of firstLoop.vectorInterfacesToDraw) {
            const d = pathDataFromCurves(vectorInterface.curves, false);
            if (!d) {
              continue;
            }
            elements.push(
              '<path d="' + escapeXml(d) + '" fill="none" stroke="' + escapeXml(rgbaToCss(vectorInterface.strokeColor)) + '" stroke-width="1" stroke-linejoin="bevel" />'
            );
          }
        }

        for (const shape of parsed.shapeList) {
          if (shape.fillColor.alpha > 0.001) {
            const pathData = shape.vectorLoopsToDraw.map((loop) => pathDataFromCurves(loop.curves, true)).filter(Boolean).join(' ');
            if (pathData) {
              const attrs = [
                'd="' + escapeXml(pathData) + '"',
                'fill="' + escapeXml(rgbaToCss(shape.fillColor)) + '"',
                'fill-rule="nonzero"',
              ];
              if (shape.fillColor.alpha < 0.999) {
                attrs.push('fill-opacity="' + fmt(shape.fillColor.alpha) + '"');
              }
              elements.push('<path ' + attrs.join(' ') + ' />');
            }
          }

          for (const loop of shape.vectorLoops) {
            if (loop.index === 0) {
              continue;
            }
            for (const vectorInterface of loop.vectorInterfacesToDraw) {
              const d = pathDataFromCurves(vectorInterface.curves, false);
              if (!d) {
                continue;
              }
              elements.push(
                '<path d="' + escapeXml(d) + '" fill="none" stroke="' + escapeXml(rgbaToCss(vectorInterface.strokeColor)) + '" stroke-width="1" stroke-linejoin="bevel" />'
              );
            }
          }
        }

        const viewBox = guessViewBox(parsed);
        const title = (document.title || 'vectorizer').replace(/\s*-\s*Vectorizer\.AI\s*$/i, '').trim();
        const baseName = (title || 'vectorizer-extracted').replace(/\.[^.]+$/, '');
        const filename = (baseName || 'vectorizer-extracted') + '.svg';
        const svg =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox.map(fmt).join(' ') + '" width="' + fmt(viewBox[2]) + '" height="' + fmt(viewBox[3]) + '">\n' +
          elements.join('\n') + '\n' +
          '</svg>\n';

        return {
          filename,
          svg,
          drawCount: elements.length,
          viewBox,
        };
      };

      const wrapWebSocket = () => {
        const OriginalWebSocket = window.WebSocket;
        if (!OriginalWebSocket || OriginalWebSocket.__vectorizerSvgWrapped) {
          return;
        }

        const isTargetSocket = (url) => typeof url === 'string' && url.indexOf('/internal/websocket') !== -1;

        const WrappedWebSocket = function (url, protocols) {
          const socket = protocols === undefined
            ? new OriginalWebSocket(url)
            : new OriginalWebSocket(url, protocols);

          if (isTargetSocket(String(url))) {
            const state = {
              pendingBinary: null,
              currentJob: null,
            };

            socket.addEventListener('message', (event) => {
              try {
                if (event.data instanceof ArrayBuffer) {
                  state.pendingBinary = event.data.slice(0);
                  return;
                }

                if (typeof event.data !== 'string') {
                  return;
                }

                const payload = JSON.parse(event.data);
                if (!payload || typeof payload.command !== 'number') {
                  return;
                }

                if (payload.command === 7 && payload.body) {
                  state.currentJob = { start: payload.body, chunks: [] };
                  tap.native.latest = state.currentJob;
                  return;
                }

                if (payload.command === 8) {
                  if (state.currentJob && state.pendingBinary) {
                    state.currentJob.chunks.push(state.pendingBinary);
                    tap.native.latest = state.currentJob;
                  }
                  state.pendingBinary = null;
                  return;
                }

                if (payload.command === 9 && state.currentJob) {
                  tap.native.latest = state.currentJob;
                }
              } catch (error) {
                console.warn('vectorizer native tap error', error);
              }
            });
          }

          return socket;
        };

        WrappedWebSocket.prototype = OriginalWebSocket.prototype;
        Object.setPrototypeOf(WrappedWebSocket, OriginalWebSocket);
        WrappedWebSocket.__vectorizerSvgWrapped = true;
        window.WebSocket = WrappedWebSocket;
      };

      const dispatchResult = (detail) => {
        document.dispatchEvent(new CustomEvent('${RESULT_EVENT}', { detail }));
      };

      document.addEventListener('${REQUEST_EVENT}', () => {
        try {
          dispatchResult({ ok: true, ...buildNativeSvg() });
        } catch (error) {
          dispatchResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
        }
      });

      wrapWebSocket();
    })();
  `;

  const injectPageScript = () => {
    const script = document.createElement('script');
    script.textContent = injectedSource;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  };

  const setLinkState = (link, busy, label) => {
    link.dataset.vectorizerSvgBusy = busy ? 'true' : 'false';
    link.setAttribute('aria-disabled', busy ? 'true' : 'false');
    link.style.opacity = busy ? '0.72' : '';
    link.style.cursor = busy ? 'wait' : '';
    link.title = label;
  };

  const setDownloadText = (text) => {
    const labelA = document.querySelector(DOWNLOAD_TEXT_SELECTOR_A);
    if (labelA) {
      labelA.textContent = text;
    }
    const labelB = document.querySelector(DOWNLOAD_TEXT_SELECTOR_B);
    if (labelB) {
      labelB.textContent = text;
    }
  };

  const triggerDownload = (filename, svg) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const hookDownloadLink = () => {
    if (!document.body) {
      return;
    }

    const link = document.getElementById(DOWNLOAD_LINK_ID);
    if (!link || link.dataset.vectorizerSvgHooked === 'true') {
      return;
    }

    link.dataset.vectorizerSvgHooked = 'true';
    link.setAttribute('href', '#svg-download');
    link.title = 'Download reconstructed SVG';
    setDownloadText(DOWNLOAD_TEXT);

    let resetTimer = null;
    const resetState = () => {
      clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => setLinkState(link, false, 'Download reconstructed SVG'), 1200);
    };

    const onResult = (event) => {
      document.removeEventListener(RESULT_EVENT, onResult);
      const detail = event.detail || {};
      if (!detail.ok) {
        setLinkState(link, false, 'No SVG Yet');
        setDownloadText(DOWNLOAD_TEXT);
        window.alert(detail.message || 'Could not extract SVG from this page.');
        resetState();
        return;
      }

      triggerDownload(detail.filename || 'vectorizer-extracted.svg', detail.svg || '');
      setLinkState(link, false, 'SVG downloaded');
      setDownloadText(DOWNLOAD_TEXT);
      resetState();
    };

    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (link.dataset.vectorizerSvgBusy === 'true') {
        return;
      }
      setLinkState(link, true, 'Building SVG...');
      setDownloadText('Downloading...');
      document.addEventListener(RESULT_EVENT, onResult, { once: true });
      document.dispatchEvent(new CustomEvent(REQUEST_EVENT));
    });
  };

  injectPageScript();

  const bootUi = () => {
    hookDownloadLink();
    const observer = new MutationObserver(() => hookDownloadLink());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUi, { once: true });
  } else {
    bootUi();
  }
})();
