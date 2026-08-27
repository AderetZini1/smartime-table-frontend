import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Dev-only: stop React's error overlay from showing raw 401s. Session expiry
// is already handled by the session-expired modal (see AuthContext); a stray
// 401 from an in-flight or interceptor-bypassing request shouldn't crash the
// overlay. Only 401s are swallowed here — all other errors surface normally.
window.addEventListener('unhandledrejection', (event) => {
  if (event?.reason?.response?.status === 401) {
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
