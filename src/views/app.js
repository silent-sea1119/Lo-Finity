import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Route, Switch, withRouter } from 'react-router-dom';

import MainPage from './pages/main-page';
import NotFoundPage from './pages/not-found-page';

export function App() {
  return (
    <div>
      <Switch>
        <Route exact path="/" component={MainPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </div>
  );
}

App.propTypes = {
  children: PropTypes.element,
};

// ==========================================================
// CONNECT
// ----------------------------------------------------------

// These are placeholders for when we do start to utilize the store for things like reports etc.

// const mapStateToProps = createSelector(
//
// );
// const mapDispatchToProps = {
//
// }

export default withRouter(
  connect(
    undefined, // mapStateToProps
    undefined, // mapDispatchToProps
  )(App),
);
