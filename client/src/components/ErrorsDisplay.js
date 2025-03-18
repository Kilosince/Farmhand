const ErrorsDisplay = ({ errors }) => {
  let errorsDisplay = null;

  // Check if 'errors' is defined and is an array with a length greater than 0
  if (errors && errors.length > 0) {
    errorsDisplay = (
      <div>
        <h2 className="validation--errors--label">Validation errors</h2>
        <div className="validation-errors">
          <ul>
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return errorsDisplay;
};

export default ErrorsDisplay;
