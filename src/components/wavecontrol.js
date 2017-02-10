// @flow
import React, { PropTypes, Component } from 'react';
import uuid from 'uuid';

import { BufferLoader } from '../utils/buffer-loader';
import { remapNumberToRange } from '../utils/range';

type Props = {
  children?: any;
  // connect: Function;
  controllers: Array<Object>;
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
    controllers: PropTypes.array.isRequired,
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

    controllers: PropTypes.array,
  };
  constructor( props ) {
    super( props );

    this.state = {
      controlWaveSamples: undefined,
      duration: 0,

      controllers: [],
      controllerIndexesLoadingSamples: []
    };
  }
  getChildContext(): Object {
    return {
      ...this.context,
      controllers: this.state.controllers
    };
  }
  componentDidMount() {
    this.id = uuid.v1();

    const master = this.context.getMaster();
    master.buffers[this.id] = 1;

    // check if this.props.sample is string or Float32Array
    // ...only use BufferLoader if string (pointing to a sample)
    // use BufferLoader to load all samples from all controllers...
    const controllerIndexesLoadingSamples = [];
    const samplePathsToLoad = [];
    this.props.controllers.forEach( (oneController, ctrlIdx) => {
      if( typeof oneController.controlWaveSamples === 'string' ) {
        controllerIndexesLoadingSamples.push( ctrlIdx );
        samplePathsToLoad.push( oneController.controlWaveSamples );
        console.log(`controller ${ctrlIdx} has sample as string`);
      }
    });
    this.setState({
      controllers: this.props.controllers
    }, () => {
      this.loadSamplePaths( samplePathsToLoad, controllerIndexesLoadingSamples );
    });
  }
  componentWillReceiveProps( nextProps: Props ) {

    if( this.isControllerSetDifferentToCurrentProps(nextProps.controllers) ) {
      const master = this.context.getMaster();
      delete master.buffers[this.id];

      this.id = uuid.v1();
      master.buffers[this.id] = 1;

      // check if nextProps.sample is string or Float32Array
      // ...only use BufferLoader if string (pointing to a sample)
      // - find those samples in all nextProps.controllers
      // that are not the same as those currently loaded,
      // and use BufferLoader to load those samples...
      const controllerIndexesLoadingSamples = [];
      const samplePathsToLoad = [];
      nextProps.controllers.forEach( (oneController, ctrlIdx) => {
        if( typeof oneController.controlWaveSamples === 'string'
            && oneController.controlWaveSamples !==
              this.props.controllers[ctrlIdx].controlWaveSamples ) {
          controllerIndexesLoadingSamples.push( ctrlIdx );
          samplePathsToLoad.push( oneController.controlWaveSamples );
        }
      });
      this.loadSamplePaths( samplePathsToLoad, controllerIndexesLoadingSamples );
    }
  }

  isControllerSetDifferentToCurrentProps( controllers ) {
    let isAnyControllerDifferent = controllers.length !== this.props.controllers.length;
    if( ! isAnyControllerDifferent ) {
      controllers.every( (oneController, index) => {
        isAnyControllerDifferent =
          oneController.controlWaveSamples !== this.props.controllers[index].controlWaveSamples
          || oneController.nodeType !== this.props.controllers[index].nodeType
          || oneController.audioParamName !== this.props.controllers[index].audioParamName
          || oneController.range !== this.props.controllers[index].range;
        return isAnyControllerDifferent;
      });
    }
    return isAnyControllerDifferent;
  }

  loadSamplePaths(
      samplePathsToLoad: Array<String>,
      controllerIndexesLoadingSamples: Array<Number> ) {

    if( samplePathsToLoad.length ) {
      this.setState({
        controllerIndexesLoadingSamples
      }, () => {
        const bufferLoader = new BufferLoader(
          this.context.audioContext,
          samplePathsToLoad,
          this.bufferLoaded.bind(this)
        );
        bufferLoader.load();
      });
    }
  }

  componentWillUnmount() {
    const master = this.context.getMaster();

    delete master.buffers[this.id];
    this.connectNode.disconnect();
  }
  bufferLoaded( buffers: Array<Object> ) {
    console.log("writing control wave samples");
    const controllerIndexes = this.state.controllerIndexesLoadingSamples;
    const controllers = this.state.controllers;
    buffers.forEach( oneBuffer => {
      // set oneBuffer to the next controllerIndexesLoadingSamples slot
      // in controllers
      const nextControllerIndex = controllerIndexes.shift();
      const controlWaveSamples = new Float32Array( oneBuffer.getChannelData(0) );
      const controlWaveRange = controllers[nextControllerIndex].range;
      if( controlWaveRange ) {
        controllers[nextControllerIndex].controlWaveSamples = controlWaveSamples.map(
          oneSample => remapNumberToRange(
            oneSample, -1, 1,
            controlWaveRange[0], controlWaveRange[1]
          )
        );
      } else {
        controllers[nextControllerIndex].controlWaveSamples = controlWaveSamples;
      }
    });
    this.setState({
      controllers,
      controllerIndexesLoadingSamples: []
    }, () => {
      console.log("controllers loaded: ", controllers);
      const master = this.context.getMaster();
      delete master.buffers[this.id];
      this.context.bufferLoaded();
    });
  }

  render(): React.Element<any> {
    return <span>{this.props.children}</span>;
  }
}
