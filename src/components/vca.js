// @flow
import React, { PropTypes, Component } from 'react';
import uuid from 'uuid';

type Props = {
  children?: any;
  steps: Array<any>;
};

type Context = {
  audioContext: Object;
  bars: number;
  barInterval: number;
  connectNode: Object;
  getMaster: Function;
  resolution: number;
  scheduler: Object;

  controlWaveSamples: Array<number>;
  controlWaveDuration: number;
  controlledAudioParamName: string;
};

export default class VCA extends Component {
  connectNode: Object;
  context: Context;
  getSteps: Function;
  playStep: Function;
  props: Props;
  static propTypes = {
    children: PropTypes.node,
    steps: PropTypes.array.isRequired,
  };
  static contextTypes = {
    audioContext: PropTypes.object,
    bars: PropTypes.number,
    barInterval: PropTypes.number,
    connectNode: PropTypes.object,
    getMaster: PropTypes.func,
    resolution: PropTypes.number,
    scheduler: PropTypes.object,

    controlWaveSamples: PropTypes.object,
    controlWaveDuration: PropTypes.number,
    controlledAudioParamName: PropTypes.string,
  };
  static childContextTypes = {
    audioContext: PropTypes.object,
    bars: PropTypes.number,
    barInterval: PropTypes.number,
    connectNode: PropTypes.object,
    getMaster: PropTypes.func,
    resolution: PropTypes.number,
    scheduler: PropTypes.object,

    controlWaveSamples: PropTypes.object,
    controlWaveDuration: PropTypes.number,
    controlledAudioParamName: PropTypes.string,
  };
  constructor( props: Props, context: Context ) {
    super( props );

    this.getSteps = this.getSteps.bind(this);
    this.playStep = this.playStep.bind(this);

    this.connectNode = context.audioContext.createGain();
    this.connectNode.connect( context.connectNode );
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
    // master.buffers[this.id] = 1; hmmm?
  }
  componentWillUnmount() {
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
        this.context.scheduler.insert(scheduledTime, this.playStep, {
          time: scheduledTime,
          step,
        });
      });
    }
  }
  playStep(e: Object) {
    console.log("VCA playStep: ", e); // TODO: doesn't get called
    const { step, time } = e.args;
    const durationMultiplication = 1.55;  // TODO: don't know why needed

    // const amplitudeGain = this.context.audioContext.createGain();
    // amplitudeGain.gain.value = 0;
    // amplitudeGain.connect(this.connectNode);

    if( this.context.controlWaveSamples
      && this.context.controlWaveDuration
      && this.context.controlledAudioParamName ) {

      this.connectNode[this.context.controlledAudioParamName].setValueCurveAtTime(
        this.context.controlWaveSamples,
        time,
        this.context.controlWaveDuration * durationMultiplication
      );
    }
  }
  render(): React.Element<any> {
    return <span>{this.props.children}</span>;
  }
}
