const pythonBaseUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://editfarmer-f93487c50b61.herokuapp.com/api' // No `/python-api` if it's not in your backend routes
    : 'http://127.0.0.1:5001'; // Local dev environment

export const pythonApi = async (path, method = 'GET', body = null) => {
  const url = `${pythonBaseUrl}${path}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error with Python API call: ${error.message}`);
    throw error;
  }
};