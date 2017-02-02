import React, { Component } from 'react';

import {
  Analyser,
  Song,
  Sequencer,
  // LFO,

  WaveControl,
  WaveSource,
  VCA,
} from '../src';

import Visualization from './visualization';

import './index.css';

export default class DemoWavekilde extends Component {
  constructor(props) {
    super(props);

    this.state = {
      playing: true,
    };

    this.handleAudioProcess = this.handleAudioProcess.bind(this);
    this.handlePlayToggle = this.handlePlayToggle.bind(this);
  }
  handleAudioProcess(analyser) {
    this.visualization.audioProcess(analyser);
  }
  handlePlayToggle() {
    this.setState({
      playing: !this.state.playing,
    });
  }
  render() {
    return (
      <div>
        <Song
          playing={this.state.playing}
          tempo={90}
        >
          <Analyser onAudioProcess={this.handleAudioProcess}>
            <Sequencer
              resolution={16}
              bars={8}
            >
              {/*
              <WaveControl
                  sample="samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_0.wav"
                  audioParamName="gain" range={[.22,.88]}>
                <VCA steps={[0,16,32]}>
              */}
                  <WaveControl
                      sample="samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_2.wav"
                      audioParamName="detune" range={[-900,900]}
                      controllers={[
                      {
                        controlWaveSamples: "samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_4.wav",
                        nodeType: "AudioBufferSourceNode",
                        audioParamName: "detune",
                        range: [-900,900]
                      },
                      {
                        controlWaveSamples: "samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_0.wav",
                        nodeType: "WaveShaperNode",
                        audioParamName: "curve"
                      },
                      {
                        controlWaveSamples: "samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_0.wav",
                        nodeType: "BiquadFilterNode",
                        audioParamName: "frequency",
                        type: "lowpass",
                        audioParamInitialValue: 1000,
                        range: [500,5000]
                      },
                      {
                        controlWaveSamples: "samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_2.wav",
                        nodeType: "GainNode",
                        audioParamName: "gain",
                        audioParamInitialValue: .5,
                        range: [0.3,0.7]
                      },
                    ]}>
                    <WaveSource
                        sample="samples/23520380-a87b-11e6-891a-d3939db90214_0_5/23520380-a87b-11e6-891a-d3939db90214_0_5_4.wav"
                        steps={[0,16,32]}>
                      {/* <LFO
                        type="sine"
                        frequency={50.0}
                        connect={(c) => c.gain}
                      /> */}
                    </WaveSource>
                  </WaveControl>
                {/*
                </VCA>
              </WaveControl>
                */}

            </Sequencer>
          </Analyser>
        </Song>

        <Visualization ref={(c) => { this.visualization = c; }} />

        <button
          className="react-music-button"
          type="button"
          onClick={this.handlePlayToggle}
        >
          {this.state.playing ? 'Stop' : 'Play'}
        </button>
      </div>
    );
  }
}
