import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // Ensure your backend URL is correct
});

const withAuthHeader = config => {
  const token = localStorage.getItem('token');
  if (!token) return config;

  const headers = config.headers ?? {};
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers['Authorization'] = `Bearer ${token}`;
  }
  config.headers = headers;
  return config;
};

// Attach the token to every request made using axios
api.interceptors.request.use(
  config => withAuthHeader(config),
  error => Promise.reject(error)
);

// If we somehow receive a 401, drop local auth data so the user can sign back in.
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
