export const api = async (path, method = 'GET', body = null, credentials = null) => {
  // Use REACT_APP_API_BASE_URL instead of NODE_ENV-based logic
  const baseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000/api";

  const url = baseUrl + path;

  const options = {
    method,
    headers: {}
  };

  if (body) {
    options.body = JSON.stringify(body);
    options.headers["Content-Type"] = "application/json; charset=utf-8";
  }

  if (credentials) {
    const encodedCredentials = btoa(`${credentials.username}:${credentials.password}`);
    options.headers.Authorization = `Basic ${encodedCredentials}`;
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await response.json();
    } else if (contentType && contentType.indexOf("text/plain") !== -1) {
      return await response.text();
    } else {
      return response;
    }
  } catch (error) {
    console.error('Error in API request:', error);
    throw error;
  }
};
