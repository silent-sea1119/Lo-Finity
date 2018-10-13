import React, { Component } from 'react';
import { connect } from 'react-redux';

import './main-page.scss';

export class MainPage extends Component {
  render() {
    return (
      <div className="main-container">
        <div className="container-fluid">
          <div className="row justify-content-md-center wrapper--custom">
            <div className="col-12">
              <h1>TEST</h1>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

// ==========================================================
// CONNECT
// ----------------------------------------------------------

export default connect(
  null,
  null,
)(MainPage);
