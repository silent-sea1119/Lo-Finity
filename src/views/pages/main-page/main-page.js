import React, { Component } from 'react';
import { connect } from 'react-redux';

import Header from '../../components/app-header';
import SickWaves from '../../components/sick-waves';

import './main-page.scss';

export class MainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      minutes: 0,
      speed: 0.5,
      color: 0x191C1F,
      height: 0.5,
      scale: 1,
    };

    setInterval(() => {
      this.setState((prevState) => {
        const minutesCopy = prevState.minutes + 1;
        return { minutes: minutesCopy };
      });
    }, 60000);
  }

  render() {
    return (
      <div className="main-container">
        <Header />
        <div className="container-fluid container__title">
          <div className="container">
            <h1 className="title_text">homemade low fidelity beats</h1>
            <h1 className="title_subtext">
listening for:&nbsp;
              {this.state.minutes}
              {' '}
minutes
            </h1>
          </div>
        </div>
        <div className="container text-center">
          <i className="far fa-play-circle play--button" />
        </div>
        <SickWaves
          style={{ width: '100vw', height: '40vh', position: 'fixed' }}
          {...this.state}
        />
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
