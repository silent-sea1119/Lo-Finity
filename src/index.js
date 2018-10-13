import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import configureStore from './core/store';
import history from './core/history';
import Lofinity from './views/app';
import registerServiceWorker from './registerServiceWorker';

import 'font-awesome/css/font-awesome.min.css';
import 'bootstrap-css-only/css/bootstrap.min.css';
import 'mdbreact/dist/css/mdb.css';

import './views/styles/styles.scss';

const rootElement = document.getElementById('root');
const store = configureStore();

function render(Component) {
  ReactDOM.render(
    <Provider store={store}>
      <Router history={history}>
        <div>
          <Component />
        </div>
      </Router>
    </Provider>,
    rootElement,
  );
}

registerServiceWorker();
render(Lofinity);
