/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/dist/";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

	"use strict";

	var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

	function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

	onmessage = function onmessage(e) {

	  var oneWaveFraction = 2 / e.data.audioWaveCount; // 2 as -1 to 1 spans two integers
	  var oneWaveMiddleFraction = oneWaveFraction / 2;
	  var waveSpectrumSpans = getSpectrumSpansForAudioWaves(e.data.audioWaveCount, oneWaveFraction, oneWaveMiddleFraction);
	  var gainValues = new Map();
	  [].concat(_toConsumableArray(Array(e.data.audioWaveCount).keys())).forEach(function (audioWaveNr) {
	    gainValues.set(audioWaveNr, new Float32Array(e.data.controlWave.length));
	  });
	  e.data.controlWave.forEach(function (oneSample, sampleIndex) {
	    var _iteratorNormalCompletion = true;
	    var _didIteratorError = false;
	    var _iteratorError = undefined;

	    try {
	      for (var _iterator = waveSpectrumSpans.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
	        var _step$value = _slicedToArray(_step.value, 2),
	            waveNr = _step$value[0],
	            spectrum = _step$value[1];

	        if (spectrum.start < oneSample && oneSample < spectrum.end) {
	          var gain = 1 - Math.abs(spectrum.middle - oneSample) / oneWaveFraction;
	          gainValues.get(waveNr)[sampleIndex] = gain;
	        } else {
	          gainValues.get(waveNr)[sampleIndex] = 0;
	        }
	      }
	    } catch (err) {
	      _didIteratorError = true;
	      _iteratorError = err;
	    } finally {
	      try {
	        if (!_iteratorNormalCompletion && _iterator.return) {
	          _iterator.return();
	        }
	      } finally {
	        if (_didIteratorError) {
	          throw _iteratorError;
	        }
	      }
	    }
	  });
	  postMessage({
	    gainValues: gainValues
	  }, [].concat(_toConsumableArray(gainValues.values())).map(function (gains) {
	    return gains.buffer;
	  }));
	};

	function getSpectrumSpansForAudioWaves(audioWaveCount, oneWaveFraction, oneWaveMiddleFraction) {
	  var waveSpectrumSpans = new Map();
	  for (var i = 0; i < audioWaveCount; i++) {
	    var spectrumStart = i * oneWaveFraction - 1; // -1 as we're working with the range -1 to 1
	    var spectrumStartFading = spectrumStart - (i ? oneWaveMiddleFraction : 0); // to start fading in the adjacent span
	    var spectrumMiddle = spectrumStart + oneWaveMiddleFraction;
	    var spectrumEnd = spectrumStart + oneWaveFraction;
	    var spectrumEndFading = spectrumEnd + (i + 1 < audioWaveCount ? oneWaveMiddleFraction : 0); // to fade into the adjacent span
	    waveSpectrumSpans.set(i, {
	      start: spectrumStartFading,
	      middle: spectrumMiddle,
	      end: spectrumEndFading
	    });
	  }
	  // console.log(`oneWaveFraction: ${oneWaveFraction}, oneWaveMiddleFraction: ${oneWaveMiddleFraction}`);
	  // console.log("waveSpectrumSpans");console.log(waveSpectrumSpans);
	  return waveSpectrumSpans;
	}

/***/ }
/******/ ]);