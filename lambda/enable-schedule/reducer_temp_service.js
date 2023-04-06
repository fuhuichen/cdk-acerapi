import _ from "lodash";
import { SET_TEMP_SERVICE } from "../actions";

export default function (state ={}, action) {

  switch (action.type) {
    case SET_TEMP_SERVICE:
      return action.payload;
    default:
      return state;
  }
}
