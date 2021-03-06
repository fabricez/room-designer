import React from 'react';
import './button.css';

// to be removed when bootstrap handles all buttons ?

export default function Button(props) {
  const { icon, text, action, cursor, status } = props;
  return (
    <div className={`fab-btn-bar ${status}`} onClick={action} title={text} style={{ cursor: cursor !== null ? cursor : 'inherit' }}>
      <i className={`${icon} fixed-width`} />
      {/* <span>{text}</span> */}
    </div>
  );
}