type FieldType = {
  name: string;
  valid: string;
  syncCall?: string;
};

type ParsedFieldType = {
  name: string;
  syncCall?: string;
  validators: Array<{
    name: string;
    parameters: string[];
  }>;
};

type EventType = "input" | "blur" | "submit" | "all";

type OptionsType = {
  mode: EventType;
  submitButtonSelector: string;
  fields: FieldType[];
};

type InstanceValidatorType = (
  this: Record<string, string>,
  value: string,
  ...parameters: string[]
) => boolean;

type ValidatorsType = {
  [key: string]: {
    message: string;
    validator: InstanceValidatorType;
  };
};

type NewValidatorType = {
  name: string;
  message: string;
  validator: InstanceValidatorType;
};

type ErrorType = Record<string, Record<string, string>>;

type InstancesType = Array<{
  selector: string;
  instances: Validator;
}>;

type OnSubmitCallback = (
  event: SubmitEvent,
  props: Readonly<Record<string, string>>
) => void;

type OnErrorCallback = (
  props: Readonly<{
    value: string;
    field: string;
    errors: Record<string, string>;
  }>
) => void;

// *****************************************

export default class Validator {
  static validators: ValidatorsType = {
    required: {
      message: "Поле обязательно для заполнения",
      validator(value) {
        return value.trim().length > 0;
      },
    },

    minLen: {
      message: "Минимум $1 символов",
      validator(value, argument) {
        return Boolean(value.trim().length >= Number(argument));
      },
    },

    maxLen: {
      message: "Максимум $1 символов",
      validator(value, argument) {
        return Boolean(value.trim().length <= Number(argument));
      },
    },

    number: {
      message: "Значение должно быть числом",
      validator(value) {
        return !isNaN(Number(value));
      },
    },

    min: {
      message: "Минимум $1",
      validator(value, min) {
        return Number(value) >= Number(min);
      },
    },

    max: {
      message: "Максимум $1",
      validator(value, max) {
        return Number(value) <= Number(max);
      },
    },

    range: {
      message: "Длинна строки должна быть от $1 до $2",
      validator(value, min, max) {
        const len = value.trim().length;
        return len >= Number(min) && len <= Number(max);
      },
    },

    email: {
      message: "Не корректный E-mail адрес",
      validator(value) {
        return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(
          value.trim()
        );
      },
    },

    confirm: {
      message: "Пароли дожны совпадать",
      validator(value, field) {
        return value === this[field];
      },
    },
  };

  private static instances: InstancesType = [];

  static callConstructorOfFactory = false;

  /**
   * Creates a new instance of Validator if it does not already exist for the given selector.
   *
   * @param {string} selector - The selector used to identify the form element.
   * @param {OptionsType} options - The options for the Validator instance.
   * @return {Validator | Validator[]} - The newly created Validator instance or the existing instance(s) for the given selector.
   */
  static create(selector: string, options: OptionsType) {
    const instance = this.instances.find((ins) => selector === ins.selector);
    if (!instance) {
      this.callConstructorOfFactory = true;
      const newInstance = new Validator(selector, options);
      this.instances.push({ selector, instances: newInstance });
      this.callConstructorOfFactory = false;
      return newInstance;
    }

    return instance.instances;
  }

  /**
   * Sets the message for a validator.
   *
   * @param {string} validatorName - The name of the validator.
   * @param {string} message - The new message for the validator.
   * @return {typeof Validator} - The Validator class.
   * @throws {Error} - If the validator is not defined.
   */
  static setMessage(validatorName: string, message: string) {
    const hasValidator = Object.keys(this.validators).includes(validatorName);
    if (hasValidator) {
      this.validators[validatorName].message = message;
    } else {
      throw new Error(`Validator "${validatorName}" not defined`);
    }

    return this;
  }

  /**
   * Sets all the messages for the validators.
   *
   * @param {Record<string, string>} messages - An object containing the validator names as keys and their corresponding messages as values.
   * @return {typeof Validator} - The Validator class.
   */
  static setAllMessages(messages: Record<string, string>) {
    Object.keys(messages).forEach((key) => {
      this.setMessage(key, messages[key]);
    });

    return this;
  }

  /**
   * Adds a new validator to the Validator class.
   *
   * @param {NewValidatorType} instance - The instance of the new validator to be added.
   * @param {boolean} [replace=false] - Optional. Whether to replace an existing validator with the same name. Default is false.
   * @return {typeof Validator} - The Validator class.
   * @throws {Error} - If a validator with the same name already exists and replace is false.
   */
  static addValidator(instance: NewValidatorType, replace = false) {
    const { name } = instance;
    const hasValidator = Object.keys(this.validators).includes(name);

    if (hasValidator && !replace) {
      throw new Error(`Validator "${name}" already present`);
    }

    this.validators[name] = { ...instance };

    return this;
  }

  // *****************************************

  private _fields: Array<ParsedFieldType> = [];
  private _form: HTMLFormElement;
  private _submitButton: HTMLButtonElement | HTMLInputElement;
  private _selector: string;
  private _errors: ErrorType = {};
  private _errorMessageElements: Record<string, HTMLDivElement> = {};
  private _valueFields: Record<string, string> = {};

  private _events: EventType[] = ["blur", "input"];
  private _mode: EventType = "input";

  private _onErrorCallback?: OnErrorCallback;
  private _onSubmitCallback?: OnSubmitCallback;

  /**
   * Creates a new instance of Validator if it does not already exist for the given selector.
   *
   * @param {string} selector - The selector used to identify the form element.
   * @param {OptionsType} options - The options for the Validator instance.
   * @throws {Error} - If the constructor is called directly instead of using the factory method.
   * @throws {Error} - If the form element identified by the selector is not found.
   * @throws {Error} - If the submit button element is not found.
   */
  private constructor(selector: string, options: OptionsType) {
    if (!Validator.callConstructorOfFactory) {
      throw new Error("Call only factory");
    }

    const form = document.querySelector<HTMLFormElement>(selector);
    const submit = document.querySelector<HTMLButtonElement | HTMLInputElement>(
      options.submitButtonSelector
    );

    if (form === null) {
      throw new Error(`Selector "${selector}" not found.`);
    }

    if (submit === null) {
      throw new Error("Button not found");
    }

    form.setAttribute("novalidate", "");

    this._mode = options.mode;

    this._form = form;
    this._submitButton = submit;

    this._selector = selector;

    this._fields = this._fieldsParser(options.fields) as ParsedFieldType[];

    this._createErrorFields();
    this._setEvents();
  }

  private _eventHandler(value: string, field: ParsedFieldType) {
    const isEmpty = value.trim().length === 0;
    const isRequired =
      field.validators.findIndex((v) => v.name === "required") >= 0;

    for (const val of field.validators) {
      const { validator, message } = Validator.validators[val.name];
      const isValid = validator.call(
        this._valueFields,
        value,
        ...val.parameters
      );

      const errorMessage = this._getErrorMessage(message, val.parameters);

      if (isValid || (isEmpty && !isRequired)) {
        try {
          delete this._errors[field.name][val.name];
        } catch (e) {}
      } else {
        if (!this._errors[field.name]) {
          this._errors[field.name] = {};
        }
        this._errors[field.name][val.name] = errorMessage;
      }
    }

    this._valueFields[field.name] = value;

    this._removeEmptyErrorFields();
    this._toggleErrorMessages();

    if (!!this._errors[field.name] && this._onErrorCallback) {
      this._onErrorCallback(
        Object.freeze({
          value,
          field: field.name,
          errors: this._errors[field.name],
        })
      );
    }
  }

  private _syncCall(vname: string) {
    const value = this._valueFields[vname] ?? "d1111";
    const field = this._fields.find(({ name }) => name === vname);
    if (field) this._eventHandler(value, field);
  }

  private _setEvents() {
    this._handleSubmit();

    for (const field of this._fields) {
      if (this._mode === "submit") {
        return;
      }

      const input = this._form[field.name];

      if (this._mode !== "all") {
        this._events = [this._mode];
      }

      this._events.forEach((eventName) => {
        input.addEventListener(
          eventName,
          (event: { target: { value: string } }) => {
            const target = event.target;
            const value = target?.value;
            this._eventHandler(value, field);

            if (field.syncCall) {
              this._syncCall(field.syncCall);
            }
          }
        );
      });
    }
  }

  private _handleSubmit() {
    this._form.addEventListener("submit", (event: SubmitEvent) => {
      this._fields.forEach((field) => {
        const value = this._form[field.name].value;
        this._eventHandler(value, field);
      });

      if (this.isError) {
        event.preventDefault();
      }

      if (this.isError === false && !!this._onSubmitCallback) {
        this._onSubmitCallback(event, this._valueFields);
      }
    });
  }

  private _createErrorFields() {
    const fields = this._fields.map(({ name }) => name);

    fields.forEach((name) => {
      const input = this._form[name];
      const element = document.createElement("div");

      element.setAttribute("class", "input-error");
      element.setAttribute("data-for", name);

      this._errorMessageElements[name] = element;

      input.after(element);
    });
  }

  private _fieldsParser(fields: FieldType[]) {
    const allFieldNames = fields.map(({ name }) => name);

    return fields.map((field) => {
      if (!!this._form[field.name] === false) {
        throw new Error(
          `Field "${field.name}" in "${this._selector}" not found.`
        );
      }

      if (field.syncCall && !allFieldNames.includes(field.syncCall)) {
        throw new Error(
          `Field "${field.syncCall}" not found. Sync option for "${field.name}" field.\n`
        );
      }

      try {
        const validators = this._validatorsParser(field.valid);
        return {
          name: field.name,
          validators,
          syncCall: field.syncCall,
        };
      } catch (e) {
        if (e instanceof Error)
          throw new Error(`Field name "${field.name}": ${e.message}`);
      }
    });
  }

  private _validatorsParser(validators: string) {
    const nameOfStaticValidators = Object.keys(Validator.validators);

    return validators
      .trim()
      .split("|")
      .map((elem) => {
        const [name, rawParams] = elem.split(":");

        const parameters = this._validatorArgumentsParser(rawParams);

        if (nameOfStaticValidators.includes(name) === false) {
          throw new Error(`Validator "${name}" not found`);
        }

        const argLen = this.getNumberOfValidatorArguments(name);

        if (argLen !== parameters.length) {
          throw new Error(
            `Validator "${name}" recevies ${argLen} arguments, recevied ${parameters.length}`
          );
        }

        return {
          name,
          parameters,
        };
      });
  }

  private _toggleErrorMessages() {
    const orderedList = this._fields.map((obj) => ({
      name: obj.name,
      order: obj.validators.map(({ name }) => name),
    }));

    orderedList.forEach((elem) => {
      const errorElement = this._errorMessageElements[elem.name];
      const visibleClass = "input-error--visible";

      for (const errorName of elem.order) {
        const isError = this._errors[elem.name];

        if (isError && isError[errorName]) {
          errorElement.classList.add(visibleClass);

          errorElement.textContent = this._errors[elem.name][errorName];
          break;
        } else {
          errorElement.classList.remove(visibleClass);
        }
      }
    });
  }

  private _disableSubmitButton(disabled: boolean) {
    this._submitButton.disabled = disabled;
  }

  private _removeEmptyErrorFields() {
    for (const field of Object.keys(this._errors)) {
      if (Object.keys(this._errors[field]).length === 0) {
        delete this._errors[field];
      }
    }
  }

  private getNumberOfValidatorArguments(name: string) {
    return Validator.validators[name].validator.length - 1;
  }

  private _validatorArgumentsParser(args: string | undefined) {
    if (typeof args === "string") {
      return args.split(",");
    } else {
      return [];
    }
  }

  private _getErrorMessage(message: string, params: string[]) {
    params.forEach((val, index) => {
      message = message.replace(`$${index + 1}`, val);
    });
    return message;
  }

  /**
   * Sets the callback function to be executed when an error occurs.
   *
   * @param {OnErrorCallback} callback - The callback function to be executed.
   * @return {this} - Returns the current instance of the class.
   */
  public onError(callback: OnErrorCallback) {
    this._onErrorCallback = callback;
    return this;
  }

  /**
   * Sets the callback function to be executed when the form is submitted.
   *
   * @param {OnSubmitCallback} callback - The callback function to be executed.
   * @return {this} - Returns the current instance of the class.
   */
  public onSubmit(callback: OnSubmitCallback) {
    this._onSubmitCallback = callback;
    return this;
  }

  /**
   * Resets all error messages and clears the error state.
   *
   * This function iterates over each field in the `_fields` array and removes the `input-error--visible` class
   * from the corresponding error message element. It also clears the `_errors` object and disables the submit button.
   *
   * @return {void} This function does not return a value.
   */
  public resetAllErrors() {
    const visibleClass = "input-error--visible";

    for (const { name } of this._fields) {
      this._errorMessageElements[name].classList.remove(visibleClass);
    }

    this._errors = {};
    this._disableSubmitButton(false);
  }

  /**
   * Returns a boolean indicating whether there are any errors present in the `_errors` object.
   *
   * @return {boolean} `true` if there are errors, `false` otherwise.
   */
  get isError() {
    return Boolean(Object.keys(this._errors).length);
  }
}
