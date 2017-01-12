// @flow
import React, { PropTypes, Component } from 'react';
import uuid from 'uuid';
import contour from 'audio-contour';

import { BufferLoader } from '../utils/buffer-loader';

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

  controlWaveSamples: Array<number>;
  controlledAudioParamName: string;
};

// based on Sampler
export default class WaveSource extends Component {
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
      attack: 0.05,
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

    controlWaveSamples: PropTypes.object,
    controlledAudioParamName: PropTypes.string,
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

    controlWaveSamples: PropTypes.object,
    controlledAudioParamName: PropTypes.string,
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
      [this.props.sample],
      this.bufferLoaded
    );

    bufferLoader.load();
  }
  componentWillReceiveProps(nextProps: Props) {

    this.connectNode.gain.value = nextProps.gain;
    if (this.props.sample !== nextProps.sample) {
      const master = this.context.getMaster();
      delete master.buffers[this.id];

      this.id = uuid.v1();
      master.buffers[this.id] = 1;

      const bufferLoader = new BufferLoader(
        this.context.audioContext,
        [nextProps.sample ],
        this.bufferLoaded
      );

      bufferLoader.load();
    }
  }
  componentWillUnmount() {
    const master = this.context.getMaster();

    delete master.buffers[this.id];
    delete master.instruments[this.id];
    this.connectNode.disconnect();
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

    //TODO: compare (delta) time and this.context.audioContext.currentTime
    // console.log("this.context.audioContext.currentTime: ", this.context.audioContext.currentTime);
    console.log("time@playStep: ", time);
    console.log("this.context.audioContext.currentTime - time: ", (this.context.audioContext.currentTime - time));

    const durationMultiplication = 1.55;  // TODO: don't know why needed

    const source = this.context.audioContext.createBufferSource();
    // source.loop = true;
    source.buffer = this.buffer;
    if (source.detune) {
      if (Array.isArray(step)) {
        source.detune.value = (this.props.detune + step[1]) * 100;
      } else {
        source.detune.value = this.props.detune;
      }
    }

    // TODO: control wave samples must come in here from all enclosing wave controls
    // along with the node type and audio param name, applied in order...

    const scheduledVsCurrentTimeDelta = 0; // (this.context.audioContext.currentTime - time)*1.5;
    // setValueCurveAtTime on controlledAudioParamName with controlWaveSamples
    if( this.context.controlWaveSamples && this.context.controlledAudioParamName ) {
      source[this.context.controlledAudioParamName].setValueCurveAtTime(
        this.context.controlWaveSamples,
        // this.context.audioContext.currentTime,
        time + scheduledVsCurrentTimeDelta,
        this.buffer.duration * durationMultiplication
      );
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

    source.connect(amplitudeGain);

    // source.connect(this.connectNode);

    if (this.props.busses) {
      const master = this.context.getMaster();
      this.props.busses.forEach((bus) => {
        if (master.busses[bus]) {
          source.connect(master.busses[bus]);
        }
      });
    }

    source.start( time, 0, this.buffer.duration );
    env.start(time);

    const finish = env.stop(
      (this.context.audioContext.currentTime + this.buffer.duration) * durationMultiplication );
    source.stop(finish);

    // this.context.scheduler.nextTick(
    //   time + this.buffer.duration, // * durationMultiplication,
    //   // this.context.audioContext.currentTime + this.buffer.duration * durationMultiplication,
    //   () => {
    //   // console.log('some clicks, but less with the durationMultiplication:');
    //   source.disconnect();
    //   env.disconnect();
    // });
  }
  bufferLoaded(buffers: Array<Object>) {
    this.buffer = buffers[0];
    const master = this.context.getMaster();
    delete master.buffers[this.id];
    this.context.bufferLoaded();
  }
  render(): React.Element<any> {
    return <span>{this.props.children}</span>;
  }
}
