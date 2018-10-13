import { createStore } from 'redux';
import reducers from './reducers';

// Setup redux store but ended up not needing to use it

export default function configureStore() {
  const store = createStore(
    reducers,
    window.REDUX_DEVTOOLS_EXTENSION && window.REDUX_DEVTOOLS_EXTENSION(),
  );

  return store;
}
