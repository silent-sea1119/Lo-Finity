import React from 'react';

import GithubLogo from '../../../assets/GitHub-Mark-Light-64px.png';
import './app-header.scss';

const AppHeader = () => {
  return (
    <div>
      <div className="navBar">
        <div className="container">
          <a href="https://jorbeatz.github.io/Lo-Finity/#/" className="navBar__title">Lo-finity <span className="navBar__subtitle">• homemade chill hip hop radio</span></a>
          <div className="navBar__actions">
            <p className="navBar__stack">React Redux | Python </p>
            <a href="https://github.com/Jorbeatz/Lo-Finity/tree/master"><img className="navBar__github" src={GithubLogo} height="30" alt="github logo"/></a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppHeader;
