import { createStore } from 'redux';
import reducers from './reducers';

export default function configureStore() {
  const store = createStore(
    reducers,
    window.REDUX_DEVTOOLS_EXTENSION && window.REDUX_DEVTOOLS_EXTENSION(),
  );

  return store;
}
