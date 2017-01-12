// @flow
import React, { PropTypes, Component } from 'react';
import uuid from 'uuid';

import { BufferLoader } from '../utils/buffer-loader';

type Props = {
  children?: any;
  // connect: Function;
  sample: string;
  range: Array<number>;
};

type Context = {
  audioContext: Object;
  connectNode: Object;
};

export default class WaveControl extends Component {
  connectNode: Object;
  context: Context;
  props: Props;
  id: String;
  static displayName = 'WaveControl';
  static propTypes = {
    children: PropTypes.node,
    connect: PropTypes.func,
    sample: PropTypes.string.isRequired,
    range: PropTypes.array.isRequired
  }
  static defaultProps = {
    connect: (node) => node.gain,
    range: [0, 1]
  };
  static contextTypes = {
    audioContext: PropTypes.object,
    connectNode: PropTypes.object,
    getMaster: PropTypes.func,
    bufferLoaded: PropTypes.func,
  };
  static childContextTypes = {
    audioContext: PropTypes.object,
    connectNode: PropTypes.object,
    getMaster: PropTypes.func,
    bufferLoaded: PropTypes.func,

    controlWaveSamples: PropTypes.object,
    controlWaveDuration: PropTypes.number,
    controlledAudioParamName: PropTypes.string,
  };
  constructor( props ) {
    super( props );
    this.state = { controlWaveSamples: undefined, duration: 0 };
  }
  getChildContext(): Object {
    return {
      ...this.context,
      controlWaveSamples: this.state.controlWaveSamples,
      controlWaveDuration: this.state.duration,
      controlledAudioParamName: this.props.audioParamName,
    };
  }
  componentDidMount() {
    this.id = uuid.v1();

    const master = this.context.getMaster();
    master.buffers[this.id] = 1;

    // TODO: check if this.props.sample is string or Float32Array
    // ...only use BufferLoader if string (pointing to a sample)
    const bufferLoader = new BufferLoader(
      this.context.audioContext,
      [ this.props.sample ],
      this.bufferLoaded.bind(this)
    );

    bufferLoader.load();
  }
  componentWillReceiveProps( nextProps: Props ) {
    if( this.props.sample !== nextProps.sample ) {
      const master = this.context.getMaster();
      delete master.buffers[this.id];

      this.id = uuid.v1();
      master.buffers[this.id] = 1;

      // TODO: check if nextProps.sample is string or Float32Array
      // ...only use BufferLoader if string (pointing to a sample)
      const bufferLoader = new BufferLoader(
        this.context.audioContext,
        [ nextProps.sample ], // TODO: multiple control waves
        this.bufferLoaded.bind(this)
      );

      bufferLoader.load();
    }
  }
  componentWillUnmount() {
    const master = this.context.getMaster();

    delete master.buffers[this.id];
    this.connectNode.disconnect();
  }
  bufferLoaded( buffers: Array<Object> ) {
    console.log("writing control wave samples");
    this.setState({
      controlWaveSamples: new Float32Array( buffers[0].getChannelData(0) ).map(
        oneSample => this.remapNumberToRange(
          oneSample, -1, 1,
          this.props.range[0], this.props.range[1]
        )
      ),
      duration: buffers[0].duration
    }, () => {
      const master = this.context.getMaster();
      delete master.buffers[this.id];
      this.context.bufferLoaded();
    });
  }
  remapNumberToRange( inputNumber, fromMin, fromMax, toMin, toMax ) {
    return (inputNumber - fromMin) / (fromMax - fromMin) * (toMax - toMin) + toMin;
  }
  render(): React.Element<any> {
    return <span>{this.props.children}</span>;
  }
}
