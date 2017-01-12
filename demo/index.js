import React from 'react';
import ReactDOM from 'react-dom';
import Demo from './demo';
import DemoWavekilde from './demoWavekilde';
import { AppContainer } from 'react-hot-loader';

ReactDOM.render(
  <AppContainer>
    <DemoWavekilde />
    {/*<Demo />*/}
  </AppContainer>,
  document.getElementById('root')
);

module.hot.accept('./demo', () => {
  const NextDemo = require('./demoWavekilde').default;
  // const NextDemo = require('./demo').default;
  ReactDOM.render(
    <AppContainer>
      <NextDemo />
    </AppContainer>,
    document.getElementById('root')
  );
});
