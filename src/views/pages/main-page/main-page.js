import React, { Component } from 'react';
import { connect } from 'react-redux';

import Header from '../../components/app-header';
import BackgroundBeat from '../../components/background-beat';

import './main-page.scss';

export class MainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      minutes: 0
    };
    setInterval(() => {
      this.setState((prevState) => {
      const minutesCopy = prevState.minutes+1;
      return { minutes: minutesCopy};
    });
    }, 60000);
  }

  render() {
    const minutes = this.state.minutes;
    console.log(minutes)
    return (
      <div className="main-container">
        <Header />
          <div className="container-fluid container__title">
            <div className="container">
              <h1 className="title_text">homemade low fidelity beats</h1>
              <h1 className="title_subtext">listening for: {this.state.minutes} minutes</h1>
            </div>
          </div>
          <div className="container">
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
