// @flow
import React, { PropTypes, Component } from 'react';
import uuid from 'uuid';
import contour from 'audio-contour';

import { BufferLoader } from '../utils/buffer-loader';
import { concatenateTypedArrays } from '../utils/arrays';

const GainValuesPerAudioWavesWorker = require("worker?inline!../workers/gain-values-per-audio-wave-worker.js");
const RemapControlArrayToValueCurveRangeWorker = require("worker?inline!../workers/remap-control-array-to-value-curve-range-worker.js");

const numWorkers = navigator.hardwareConcurrency || 4;

type Envelope = {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
};

type Props = {
  busses: Array<string>;
  children?: any;
  detune?: number;
  envelope: Envelope;
  gain?: number;
  sample: string;
  steps: Array<any>;
};

type Context = {
  audioContext: Object;
  bars: number;
  barInterval: number;
  bufferLoaded: Function;
  connectNode: Object;
  getMaster: Function;
  resolution: number;
  scheduler: Object;
  tempo: number;

  controllers: Array<Object>;
};

// based on Sampler
export default class WaveTable extends Component {
  buffer: Object;
  bufferLoaded: Function;
  connectNode: Object;
  context: Context;
  id: String;
  getSteps: Function;
  playStep: Function;
  props: Props;
  static displayName = 'WaveSource';
  static propTypes = {
    busses: PropTypes.array,
    children: PropTypes.node,
    envelope: PropTypes.shape({
      attack: PropTypes.number,
      decay: PropTypes.number,
      sustain: PropTypes.number,
      release: PropTypes.number,
    }),
    detune: PropTypes.number,
    gain: PropTypes.number,
    sample: PropTypes.string.isRequired,
    steps: PropTypes.array.isRequired,
  };
  static defaultProps = {
    envelope: {
      attack: 0.08,
      decay: .8,
      sustain: 0.6,
      release: 0.5,
    },
    detune: 0,
    gain: 0.5,
  };
  static contextTypes = {
    audioContext: PropTypes.object,
    bars: PropTypes.number,
    barInterval: PropTypes.number,
    bufferLoaded: PropTypes.func,
    connectNode: PropTypes.object,
    getMaster: PropTypes.func,
    resolution: PropTypes.number,
    scheduler: PropTypes.object,
    tempo: PropTypes.number,

    controllers: PropTypes.array,
  };
  static childContextTypes = {
    audioContext: PropTypes.object,
    bars: PropTypes.number,
    barInterval: PropTypes.number,
    bufferLoaded: PropTypes.func,
    connectNode: PropTypes.object,
    getMaster: PropTypes.func,
    resolution: PropTypes.number,
    scheduler: PropTypes.object,
    tempo: PropTypes.number,

    controllers: PropTypes.array,
  };
  constructor(props: Props, context: Context) {
    super(props);

    this.bufferLoaded = this.bufferLoaded.bind(this);
    this.getSteps = this.getSteps.bind(this);
    this.playStep = this.playStep.bind(this);

    this.connectNode = context.audioContext.createGain();
    this.connectNode.gain.value = props.gain;
    this.connectNode.connect(context.connectNode);
  }
  getChildContext(): Object {
    return {
      ...this.context,
      connectNode: this.connectNode,
    };
  }
  componentDidMount() {
    this.id = uuid.v1();

    const master = this.context.getMaster();
    master.instruments[this.id] = this.getSteps;
    master.buffers[this.id] = 1;

    const bufferLoader = new BufferLoader(
      this.context.audioContext,
      this.props.waves,
      this.bufferLoaded
    );

    bufferLoader.load();
  }
  componentWillReceiveProps(nextProps: Props) {
    const master = this.context.getMaster();
    this.connectNode.gain.value = nextProps.gain;

    if( this.isWaveSetDifferentToCurrentProps(nextProps.waves) ) {

      delete master.buffers[this.id];

      this.id = uuid.v1();
      master.buffers[this.id] = 1;

      const bufferLoader = new BufferLoader(
        this.context.audioContext,
        nextProps.waves,
        this.bufferLoaded
      );

      bufferLoader.load();
    }

    if( this.context.controllers.length ) {
      let isAnyControllerWaveSampleNotLoaded = false;
      this.context.controllers.every( oneController => {
        isAnyControllerWaveSampleNotLoaded = (typeof oneController.controlWaveSamples === 'string');
        return isAnyControllerWaveSampleNotLoaded;
      });
      if( ! isAnyControllerWaveSampleNotLoaded // all controller wave samples have been loaded
        && master.buffers[this.id] // but we haven't rendered the buffer with those controllers
      ) {
        this.controllerBuffersLoaded();
      }
    }
  }
  componentWillUnmount() {
    const master = this.context.getMaster();

    delete master.buffers[this.id];
    delete master.instruments[this.id];
    this.connectNode.disconnect();
  }

  isWaveSetDifferentToCurrentProps( waves ) {
    let isAnyWaveDifferent = false;
    waves.every( (oneWave, index) => {
      isAnyWaveDifferent = oneWave !== this.props.waves[index];
      return isAnyWaveDifferent;
    });
    return isAnyWaveDifferent;
  }

  getSteps(playbackTime: number) {
    const totalBars = this.context.getMaster().getMaxBars();
    const loopCount = totalBars / this.context.bars;
    for (let i = 0; i < loopCount; i++) {
      const barOffset = ((this.context.barInterval * this.context.bars) * i) / 1000;
      const stepInterval = this.context.barInterval / this.context.resolution;

      this.props.steps.forEach((step) => {
        const stepValue = Array.isArray(step) ? step[0] : step;
        const time = barOffset + ((stepValue * stepInterval) / 1000);
        const scheduledTime = playbackTime + time;
        this.context.scheduler.insert(playbackTime + time, this.playStep, {
          time: scheduledTime,
          step,
        });
      });
    }
  }
  playStep(e: Object) {
    const { step, time } = e.args;

    console.log("time@playStep: ", time);
    // compare (delta) time and this.context.audioContext.currentTime
    console.log("this.context.audioContext.currentTime - time: ", (this.context.audioContext.currentTime - time));

    const durationMultiplication = 1.55;  // TODO: don't know why needed

    const source = this.context.audioContext.createBufferSource();
    source.buffer = this.renderedBuffer;
    // source.loop = true;
    if (source.detune) {
      if (Array.isArray(step)) {
        source.detune.value = (this.props.detune + step[1]) * 100;
      } else {
        source.detune.value = this.props.detune;
      }
    }

    // ASDR
    const amplitudeGain = this.context.audioContext.createGain();
    amplitudeGain.gain.value = 0;
    amplitudeGain.connect(this.connectNode);

    const env = contour(this.context.audioContext, {
      attack: this.props.envelope.attack,
      decay: this.props.envelope.decay,
      sustain: this.props.envelope.sustain,
      release: this.props.envelope.release,
    });

    env.connect(amplitudeGain.gain);

    source.connect( amplitudeGain );

    if (this.props.busses) {
      const master = this.context.getMaster();
      this.props.busses.forEach((bus) => {
        if (master.busses[bus]) {
          source.connect(master.busses[bus]);
        }
      });
    }

    source.start( time, 0, this.getWaveDuration() );
    env.start(time);

    const stopTime = (time + this.getWaveDuration()) * durationMultiplication;
    const finish = env.stop( stopTime );
    source.stop( finish );

    this.context.scheduler.nextTick( stopTime, () => {
      source.disconnect();
      env.disconnect();
    });
  }

  getWaveDuration() {
    if( this.waveBuffers.length ) {
      return this.waveBuffers[0].duration;
    } else {
      return 0;
    }
  }

  bufferLoaded(buffers: Array<Object>) {
    console.log("bufferLoaded");
    this.waveBuffers = buffers;

    if( ! this.context.controllers.length ) {
      this.clearBuffersLoadingLock();
    } // otherwise we'll let controllerBuffersLoaded clear the locks when done
  }
  controllerBuffersLoaded() {
    console.log("controllerBuffersLoaded");
    this.renderBufferWithControllers().then( renderedBuffer => {

      this.renderedBuffer = renderedBuffer;

      this.clearBuffersLoadingLock();
    });
  }
  clearBuffersLoadingLock() {
    const master = this.context.getMaster();
    delete master.buffers[this.id];
    this.context.bufferLoaded();
  }
  renderBufferWithControllers() {
    return new Promise( (resolve, reject) => {

      const sizeInSamples = this.context.audioContext.sampleRate * this.getWaveDuration();
      const offlineCtx = new OfflineAudioContext( 1 /*channels*/,
        sizeInSamples, this.context.audioContext.sampleRate );

      const audioSources = this.waveBuffers.map( oneBuffer => {
        const oneAudioSource = offlineCtx.createBufferSource();
        oneAudioSource.buffer = oneBuffer;
        return oneAudioSource;
      });

      const durationMultiplication = 1.55;  // TODO: don't know why needed

      let mixWaveController = null;
      this.context.controllers.some( oneController => {
        if( 'mixwave' === oneController.nodeType ) {
          mixWaveController = oneController;
          return true;
        }
      });

      if( mixWaveController ) {

        const duration = this.getWaveDuration() * durationMultiplication;

        // gain values for each audio wave in the wave table,
        // each controlled by a value curve from the calculated gain values
        this.spawnMultipleGainValuesPerAudioWaveWorkers(
          this.props.waves.length, mixWaveController.controlWaveSamples
        ).then( gainValues => {

          this.getAudioSourceGains( gainValues, offlineCtx, duration )
          .then( audioSourceGains => {

            // connect each audio source to a gain node,
            audioSources.forEach(
              (audioSource, index) => audioSource.connect( audioSourceGains[index] ) );

            // instantiate a merger; mixer
            let mergerNode = offlineCtx.createChannelMerger( audioSources.length );

            // connect the output of each audio source gain to the mixer
            audioSourceGains.forEach(
              (audioGain, index) => audioGain.connect( mergerNode, 0, index ) );

            // connect the mixer to the output device
            mergerNode.connect( offlineCtx.destination );

            console.log(`starting rendering of ${audioSources.length} waves mixed with controller wave: `, mixWaveController);

            // start all the audio sources
            let currentTime = offlineCtx.currentTime;
            audioSources.forEach( audioSource => audioSource.start(currentTime) );

            offlineCtx.startRendering().then( renderedBuffer => {
              console.log('Rendering completed successfully');

              resolve( renderedBuffer );

            }).catch( err => {
              reject( "Not able to render audio buffer from this.waveBuffers and this.context.controllers: " + err )
            });

          }); // gain value curve remapping promise

        }); // gain calculation promise


      } else {
        reject( "Wave table wasn't wired up with gains set according to mix wave, probably because the mix wave was missing." );
      }

    });
  }



  spawnMultipleGainValuesPerAudioWaveWorkers( audioWaveCount, controlWave ) {
    const chunk = Math.round( controlWave.length / numWorkers );

    const gainValuePromises = [];
    for( let i=0, j=controlWave.length; i<j; i+=chunk ) {
      const controlWaveSlice = controlWave.slice( i, i+chunk );

      gainValuePromises.push(
        this.spawnOneGainValuesPerAudioWaveWorker(
          audioWaveCount, controlWaveSlice )
      );
    }
    return Promise.all( gainValuePromises ).then( arrayOfSubGainValues => {

      return this.getCombinedGainValuesFromSubResults( arrayOfSubGainValues );
    });
  }

  spawnOneGainValuesPerAudioWaveWorker( audioWaveCount, controlWave ) {
    const promise = new Promise( (resolve, reject) => {
      const gainValuesPerAudioWaveWorker = new GainValuesPerAudioWavesWorker();
      gainValuesPerAudioWaveWorker.postMessage({
        audioWaveCount,
        controlWave
      }, [controlWave.buffer] );
      gainValuesPerAudioWaveWorker.onmessage = (e) => {

        resolve( e.data.gainValues );
      };
    });
    return promise;
  }

  getCombinedGainValuesFromSubResults( arrayOfSubGainValues ) {

    // initialize a Map of gain values using the first sub result as template
    const gainValues = new Map( [...arrayOfSubGainValues[0].entries()].map( oneEntry => {
      return [
         oneEntry[0],
         // will hold sub sample arrays, which will then be concatenated:
         new Array(arrayOfSubGainValues.length)
       ];
    }) );

    // combine gain values from each sub result
    const gainSubArrays = [];
    arrayOfSubGainValues.forEach( (subGainValues, subIndex) => {
      for( let [gainIndex, gainSubValues] of subGainValues ) {
        // add sub array of gain values
        gainValues.get( gainIndex )[subIndex] = gainSubValues;
      }
    });
    for( let [gainIndex, gainValuesSubArrays] of gainValues ) {
      gainValues.set(gainIndex,
        // combine the sub arrays
        concatenateTypedArrays(Float32Array, gainValuesSubArrays) );
    }
    return gainValues;
  }



  getAudioSourceGains( gainValues, audioCtx, duration ) {

    const gainValueCurvePromises = [];
    gainValues.forEach( (oneGainControlArray, gainIndex) => {

      gainValueCurvePromises.push(
        this.getGainControlArrayRemappedToValueCurveRange( oneGainControlArray )
      );
    });
    return Promise.all( gainValueCurvePromises ).then( gainValueCurveArrays => {
      const audioSourceGains = [];
      gainValueCurveArrays.forEach( oneValueCurveArray => {
        let VCA = audioCtx.createGain();
        VCA.gain.setValueCurveAtTime(
          oneValueCurveArray, audioCtx.currentTime, duration );
        audioSourceGains.push( VCA );
      });
      return audioSourceGains;
    });
  }

  getGainControlArrayRemappedToValueCurveRange( gainControlArray ) {

    return new Promise(function(resolve, reject) {
      const remapControlArrayToValueCurveRangeWorker =
        new RemapControlArrayToValueCurveRangeWorker();

      remapControlArrayToValueCurveRangeWorker.postMessage({
        gainControlArray
      }, [gainControlArray.buffer] );

      remapControlArrayToValueCurveRangeWorker.onmessage = (e) => {
        resolve( e.data.valueCurve );
      };
    });
  }



  render(): React.Element<any> {
    return <span>{this.props.children}</span>;
  }
}
