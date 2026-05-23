// ==UserScript==
// @name         Vectorizer.AI Free Download
// @namespace    https://vectorizer.ai/
// @version      1.0.0
// @author       Syntask
// @description  Bypass download paywall on vectorizer.ai by constructing SVGs from intercepted canvas drawing commands.
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
  const DOWNLOAD_TEXT_SELECTOR_A = '#App-DownloadLink span span.showPaid';
  const DOWNLOAD_TEXT_SELECTOR_B = '#App-DownloadLink span span.showFree';
  const DOWNLOAD_TEXT = 'DOWNLOAD 🏴‍☠️';

  const injectedSource = String.raw`
    (() => {
      if (window.${PAGE_FLAG}) {
        return;
      }
      window.${PAGE_FLAG} = true;

      const TAU = Math.PI * 2;
      const tap = {
        calls: [],
        canvases: [],
        paths: [],
        pathMap: new WeakMap(),
        ctxMap: new WeakMap(),
      };
      window.__vectorizerSvgTap = tap;

      const fmt = (value) => {
        const number = Math.abs(value) < 1e-9 ? 0 : value;
        return Number(number.toFixed(4)).toString();
      };

      const ensurePath = (path) => {
        let id = tap.pathMap.get(path);
        if (id === undefined) {
          id = tap.paths.length;
          tap.pathMap.set(path, id);
          tap.paths.push({ id, ops: [] });
        }
        return id;
      };

      const ensureContext = (ctx) => {
        let info = tap.ctxMap.get(ctx);
        if (!info) {
          info = { canvasId: null };
          tap.ctxMap.set(ctx, info);
        }
        return info;
      };

      const serializeArg = (arg) => {
        if (arg && (typeof arg === 'object' || typeof arg === 'function')) {
          const pathId = tap.pathMap.get(arg);
          if (pathId !== undefined) {
            return { __pathId: pathId };
          }
          if (arg instanceof HTMLCanvasElement) {
            return { __canvas: arg.id || null, width: arg.width, height: arg.height };
          }
          if (arg instanceof HTMLImageElement) {
            return {
              __image: arg.currentSrc || arg.src || null,
              width: arg.naturalWidth,
              height: arg.naturalHeight,
            };
          }
        }
        return arg;
      };

      const wrapPath2D = () => {
        const OriginalPath2D = window.Path2D;
        if (!OriginalPath2D || OriginalPath2D.__vectorizerSvgWrapped) {
          return;
        }

        const pathMethods = [
          'moveTo',
          'lineTo',
          'bezierCurveTo',
          'quadraticCurveTo',
          'arc',
          'arcTo',
          'ellipse',
          'rect',
          'roundRect',
          'closePath',
          'addPath',
        ];

        for (const name of pathMethods) {
          const original = OriginalPath2D.prototype[name];
          if (typeof original !== 'function' || original.__vectorizerSvgWrapped) {
            continue;
          }
          const wrapped = function (...args) {
            const id = ensurePath(this);
            tap.paths[id].ops.push({ method: name, args: args.map(serializeArg) });
            return original.apply(this, args);
          };
          wrapped.__vectorizerSvgWrapped = true;
          OriginalPath2D.prototype[name] = wrapped;
        }

        const WrappedPath2D = function (...args) {
          const path = new OriginalPath2D(...args);
          const id = ensurePath(path);
          tap.paths[id].createdWith = args.map(serializeArg);
          return path;
        };
        WrappedPath2D.prototype = OriginalPath2D.prototype;
        Object.setPrototypeOf(WrappedPath2D, OriginalPath2D);
        WrappedPath2D.__vectorizerSvgWrapped = true;
        window.Path2D = WrappedPath2D;
      };

      const wrapCanvas = () => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        if (!getContext.__vectorizerSvgWrapped) {
          const wrappedGetContext = function (type, ...args) {
            const ctx = getContext.call(this, type, ...args);
            if (ctx && type === '2d') {
              const info = ensureContext(ctx);
              if (info.canvasId === null) {
                info.canvasId = tap.canvases.length;
                tap.canvases.push({
                  tapId: info.canvasId,
                  id: this.id,
                  width: this.width,
                  height: this.height,
                });
              }
            }
            return ctx;
          };
          wrappedGetContext.__vectorizerSvgWrapped = true;
          HTMLCanvasElement.prototype.getContext = wrappedGetContext;
        }

        const methods = [
          'beginPath',
          'closePath',
          'moveTo',
          'lineTo',
          'bezierCurveTo',
          'quadraticCurveTo',
          'arc',
          'arcTo',
          'ellipse',
          'rect',
          'roundRect',
          'fill',
          'stroke',
          'clip',
          'save',
          'restore',
          'translate',
          'rotate',
          'scale',
          'transform',
          'setTransform',
          'resetTransform',
          'fillRect',
          'strokeRect',
          'clearRect',
          'drawImage',
          'fillText',
          'strokeText',
        ];

        for (const name of methods) {
          const original = CanvasRenderingContext2D.prototype[name];
          if (typeof original !== 'function' || original.__vectorizerSvgWrapped) {
            continue;
          }
          const wrapped = function (...args) {
            const info = ensureContext(this);
            tap.calls.push({
              method: name,
              args: args.map(serializeArg),
              canvasId: info.canvasId,
              fillStyle: String(this.fillStyle),
              strokeStyle: String(this.strokeStyle),
              lineWidth: this.lineWidth,
              globalAlpha: this.globalAlpha,
              lineJoin: this.lineJoin,
              lineCap: this.lineCap,
              miterLimit: this.miterLimit,
              globalCompositeOperation: this.globalCompositeOperation,
            });
            return original.apply(this, args);
          };
          wrapped.__vectorizerSvgWrapped = true;
          CanvasRenderingContext2D.prototype[name] = wrapped;
        }
      };

      const pointOnEllipse = (cx, cy, rx, ry, rotation, angle) => {
        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);
        return {
          x: cx + cosRot * rx * cosAngle - sinRot * ry * sinAngle,
          y: cy + sinRot * rx * cosAngle + cosRot * ry * sinAngle,
        };
      };

      const appendArc = (parts, cx, cy, rx, ry, rotation, start, end, anticlockwise) => {
        const endPoint = pointOnEllipse(cx, cy, rx, ry, rotation, end);
        const delta = end - start;
        const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
        const sweepFlag = anticlockwise ? 0 : 1;
        parts.push(
          'A ' +
            fmt(rx) + ' ' +
            fmt(ry) + ' ' +
            fmt((rotation * 180) / Math.PI) + ' ' +
            largeArc + ' ' +
            sweepFlag + ' ' +
            fmt(endPoint.x) + ' ' +
            fmt(endPoint.y)
        );
        return endPoint;
      };

      const ellipseToCommands = (cx, cy, rx, ry, rotation, startAngle, endAngle, anticlockwise, currentPoint) => {
        let delta = endAngle - startAngle;
        if (!anticlockwise && delta < 0) {
          delta += TAU * Math.ceil(-delta / TAU);
        }
        if (anticlockwise && delta > 0) {
          delta -= TAU * Math.ceil(delta / TAU);
        }
        if (Math.abs(delta) > TAU) {
          delta = anticlockwise ? -TAU : TAU;
        }

        const startPoint = pointOnEllipse(cx, cy, rx, ry, rotation, startAngle);
        const parts = [];
        if (!currentPoint) {
          parts.push('M ' + fmt(startPoint.x) + ' ' + fmt(startPoint.y));
        } else if (Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) > 1e-4) {
          parts.push('L ' + fmt(startPoint.x) + ' ' + fmt(startPoint.y));
        }

        let endPoint;
        if (Math.abs(Math.abs(delta) - TAU) < 1e-5) {
          const midAngle = startAngle + delta / 2;
          appendArc(parts, cx, cy, rx, ry, rotation, startAngle, midAngle, anticlockwise);
          endPoint = appendArc(parts, cx, cy, rx, ry, rotation, midAngle, startAngle, anticlockwise);
        } else {
          endPoint = appendArc(parts, cx, cy, rx, ry, rotation, startAngle, startAngle + delta, anticlockwise);
        }

        return { parts, startPoint, endPoint };
      };

      const pathToD = (path) => {
        const parts = [];
        let currentPoint = null;
        let subpathStart = null;

        for (const op of path.ops) {
          const args = op.args;
          switch (op.method) {
            case 'moveTo':
              currentPoint = { x: args[0], y: args[1] };
              subpathStart = currentPoint;
              parts.push('M ' + fmt(args[0]) + ' ' + fmt(args[1]));
              break;
            case 'lineTo':
              currentPoint = { x: args[0], y: args[1] };
              parts.push('L ' + fmt(args[0]) + ' ' + fmt(args[1]));
              break;
            case 'bezierCurveTo':
              currentPoint = { x: args[4], y: args[5] };
              parts.push(
                'C ' +
                  fmt(args[0]) + ' ' + fmt(args[1]) + ' ' +
                  fmt(args[2]) + ' ' + fmt(args[3]) + ' ' +
                  fmt(args[4]) + ' ' + fmt(args[5])
              );
              break;
            case 'quadraticCurveTo':
              currentPoint = { x: args[2], y: args[3] };
              parts.push(
                'Q ' +
                  fmt(args[0]) + ' ' + fmt(args[1]) + ' ' +
                  fmt(args[2]) + ' ' + fmt(args[3])
              );
              break;
            case 'ellipse': {
              const result = ellipseToCommands(
                args[0],
                args[1],
                args[2],
                args[3],
                args[4],
                args[5],
                args[6],
                Boolean(args[7]),
                currentPoint
              );
              parts.push(...result.parts);
              if (!subpathStart) {
                subpathStart = result.startPoint;
              }
              currentPoint = result.endPoint;
              break;
            }
            case 'rect':
              parts.push(
                'M ' + fmt(args[0]) + ' ' + fmt(args[1]) +
                ' L ' + fmt(args[0] + args[2]) + ' ' + fmt(args[1]) +
                ' L ' + fmt(args[0] + args[2]) + ' ' + fmt(args[1] + args[3]) +
                ' L ' + fmt(args[0]) + ' ' + fmt(args[1] + args[3]) +
                ' Z'
              );
              currentPoint = { x: args[0], y: args[1] };
              subpathStart = currentPoint;
              break;
            case 'closePath':
              parts.push('Z');
              currentPoint = subpathStart;
              break;
            default:
              throw new Error('Unsupported path op: ' + op.method);
          }
        }

        return parts.join(' ');
      };

      const escapeXml = (text) => String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const guessTargetCanvas = () => {
        const stats = new Map();
        for (const call of tap.calls) {
          if (call.canvasId == null) {
            continue;
          }
          const stat = stats.get(call.canvasId) || {
            pathDraws: 0,
            pathIds: new Set(),
            rects: 0,
            total: 0,
          };
          stat.total += 1;
          if ((call.method === 'fill' || call.method === 'stroke') && call.args[0] && call.args[0].__pathId !== undefined) {
            stat.pathDraws += 1;
            stat.pathIds.add(call.args[0].__pathId);
          }
          if (call.method === 'rect') {
            stat.rects += 1;
          }
          stats.set(call.canvasId, stat);
        }

        const ranked = Array.from(stats.entries())
          .map(([canvasId, stat]) => ({
            canvasId,
            pathDraws: stat.pathDraws,
            uniquePaths: stat.pathIds.size,
            rects: stat.rects,
            total: stat.total,
            canvas: tap.canvases[canvasId] || null,
          }))
          .filter((entry) => entry.pathDraws > 0)
          .sort((a, b) => {
            if (b.pathDraws !== a.pathDraws) return b.pathDraws - a.pathDraws;
            if (b.uniquePaths !== a.uniquePaths) return b.uniquePaths - a.uniquePaths;
            if ((b.canvas?.width || 0) !== (a.canvas?.width || 0)) return (b.canvas?.width || 0) - (a.canvas?.width || 0);
            return (b.canvas?.height || 0) - (a.canvas?.height || 0);
          });

        return ranked[0] || null;
      };

      const buildSvg = () => {
        const target = guessTargetCanvas();
        if (!target) {
          throw new Error('No vector draw commands captured yet. Reload the page after the userscript is installed, then try again.');
        }

        const vectorCalls = tap.calls.filter((call) => call.canvasId === target.canvasId);
        const drawCalls = vectorCalls.filter(
          (call) => (call.method === 'fill' || call.method === 'stroke') && call.args[0] && call.args[0].__pathId !== undefined
        );
        if (!drawCalls.length) {
          throw new Error('Vector draw commands were not found on the selected canvas.');
        }

        const clipRect = vectorCalls.find((call) => call.method === 'rect' && Array.isArray(call.args) && call.args.length === 4);
        const viewBox = clipRect ? clipRect.args : [0, 0, target.canvas?.width || 1024, target.canvas?.height || 1024];

        const body = drawCalls.map((call) => {
          const pathId = call.args[0].__pathId;
          const d = pathToD(tap.paths[pathId]);
          const attrs = [];
          if (call.method === 'fill') {
            attrs.push('fill="' + escapeXml(call.fillStyle) + '"');
            attrs.push('stroke="none"');
            if (call.globalAlpha !== 1) {
              attrs.push('fill-opacity="' + fmt(call.globalAlpha) + '"');
            }
          } else {
            attrs.push('fill="none"');
            attrs.push('stroke="' + escapeXml(call.strokeStyle) + '"');
            attrs.push('stroke-width="' + fmt(call.lineWidth) + '"');
            if (call.lineJoin && call.lineJoin !== 'miter') {
              attrs.push('stroke-linejoin="' + escapeXml(call.lineJoin) + '"');
            }
            if (call.lineCap && call.lineCap !== 'butt') {
              attrs.push('stroke-linecap="' + escapeXml(call.lineCap) + '"');
            }
            if (call.miterLimit && call.miterLimit !== 10) {
              attrs.push('stroke-miterlimit="' + fmt(call.miterLimit) + '"');
            }
            if (call.globalAlpha !== 1) {
              attrs.push('stroke-opacity="' + fmt(call.globalAlpha) + '"');
            }
          }
          return '<path d="' + escapeXml(d) + '" ' + attrs.join(' ') + ' />';
        }).join('\n');

        const title = (document.title || 'vectorizer').replace(/\s*-\s*Vectorizer\.AI\s*$/i, '').trim();
        const baseName = (title || 'vectorizer-extracted').replace(/\.[^.]+$/, '');
        const filename = (baseName || 'vectorizer-extracted') + '.svg';
        const svg =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
          viewBox.map(fmt).join(' ') +
          '" width="' + fmt(viewBox[2]) + '" height="' + fmt(viewBox[3]) + '">\n' +
          body + '\n' +
          '</svg>\n';

        return {
          filename,
          svg,
          drawCount: drawCalls.length,
          viewBox,
          canvasId: target.canvasId,
        };
      };

      const dispatchResult = (detail) => {
        document.dispatchEvent(new CustomEvent('${RESULT_EVENT}', { detail }));
      };

      document.addEventListener('${REQUEST_EVENT}', () => {
        try {
          dispatchResult({ ok: true, ...buildSvg() });
        } catch (error) {
          dispatchResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
        }
      });

      wrapPath2D();
      wrapCanvas();
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
    const label = document.querySelector(DOWNLOAD_TEXT_SELECTOR_A);
    if (label) {
      label.textContent = text;
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