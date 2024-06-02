import Validator from "./dist/index.js";

const ins = Validator.create(".my-form", {
  mode: "input",
  submitButtonSelector: ".form__submit",
  fields: [
    { name: "name", valid: "required|minLen:4|maxLen:5" },
    { name: "tel", valid: "required|minLen:4" },
    { name: "age", valid: "required|number|min:10|max:32" },
    { name: "email", valid: "email" },
    //
    { name: "password", valid: "required|minLen:5", syncCall: "confirm" },
    { name: "confirm", valid: "required|confirm:password" },
  ],
});

ins.onSubmit((e, fields) => {
  e.preventDefault();
  console.log(fields);
});

ins.onError((e, fields) => {
  e.preventDefault();
  console.log(e, fields);
});
