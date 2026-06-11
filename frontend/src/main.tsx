import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Placeholder App - người dùng tích hợp các components vào đây
const App = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900">Site360</h1>
      <p className="text-gray-500">Hệ thống Giám sát Công trường Thông minh bằng Ảnh 360°</p>
      <p className="text-sm text-gray-400">Frontend framework đã sẵn sàng - Hãy tích hợp các components!</p>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
