import React, {useState} from 'react'
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { makeStyles } from "@mui/styles";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import moment from 'moment';


const useStyles = makeStyles({
  actionTextField: {
    padding: "0px 10px 0px 0px",
    width: "140px",
  },
  actionForm: {
    padding: "10px 0px 0px 0px",
  }
});


const actionToAct = {
  "remove_waste": "removing waste",
  "add_media": "adding media",
  "add_alt_media": "adding alt. media",

}

export default function ActionPumpForm(props) {
  const EMPTYSTATE = "";
  const classes = useStyles();
  const [mL, setML] = useState(EMPTYSTATE);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [textfieldError, setTextfieldError] = useState(false);
  const [manualAction, setManualAction] = useState("add_media")

  const [formErrorML, setFormErrorML] = useState(false)


  function onSubmit(e) {
    e.preventDefault();
    if (mL > 0) {

      var msg = `Recorded ${actionToAct[manualAction]} of ${mL} mL at ${moment().format('h:mm:ss a')}.`
      var params = { ml: parseFloat(mL), source_of_event: "manually", manually: true};

      fetch(`/api/run/${props.unit}/${manualAction}`, {
        method: "PATCH",
        body: JSON.stringify({options: params, args: []}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      setSnackbarMsg(msg)
      setOpenSnackbar(true);
      setML(EMPTYSTATE)
    }
    else {
      setTextfieldError(true)
    }

  }


  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  function handleMLChange(e) {
    const re = /^[0-9.\b]+$/;
    setTextfieldError(false)

    setML(e.target.value);

    if (e.target.value === EMPTYSTATE || re.test(e.target.value)) {
      setFormErrorML(false)
    }
    else {
      setFormErrorML(true)
    }
  }

  function handleRadioChange(e) {
    setManualAction(e.target.value);
    setML(EMPTYSTATE)
  }

  return (
    <div id={props.action} className={classes.actionForm}>
      <FormControl>
        <RadioGroup
          aria-labelledby="what action"
          name="what action"
          value={manualAction}
          onChange={handleRadioChange}
        >
          <div style={{marginBottom: "10px", maxWidth: "460px", display: "flex", justifyContent: "space-between"}}>
            <FormControlLabel value="add_media" control={<Radio />} label="Add media" />
            <TextField
              name="mL"
              autoComplete={"off"}
              error={formErrorML || textfieldError}
              value={manualAction === 'add_media' ? mL : EMPTYSTATE}
              size="small"
              variant="outlined"
              onChange={handleMLChange}
              disabled={manualAction !== 'add_media'}
              className={classes.actionTextField}
              InputProps={{
                endAdornment: <InputAdornment position="end">mL</InputAdornment>,
              }}
            />
          </div>
          <div style={{marginBottom: "10px", maxWidth: "460px", display: "flex", justifyContent: "space-between"}}>
            <FormControlLabel value="add_alt_media" control={<Radio />} label="Add alt-media" />
            <TextField
              name="mL"
              autoComplete={"off"}
              error={formErrorML || textfieldError}
              value={manualAction === 'add_alt_media' ? mL : EMPTYSTATE}
              size="small"
              variant="outlined"
              onChange={handleMLChange}
              disabled={manualAction !== 'add_alt_media'}
              className={classes.actionTextField}
              InputProps={{
                endAdornment: <InputAdornment position="end">mL</InputAdornment>,
              }}
            />
          </div>
          <div style={{marginBottom: "10px", maxWidth: "460px", display: "flex", justifyContent: "space-between"}}>
            <FormControlLabel value="remove_waste" control={<Radio />} label="Remove waste" />
            <TextField
              name="mL"
              autoComplete={"off"}
              error={formErrorML || textfieldError}
              value={manualAction === 'remove_waste' ? mL : EMPTYSTATE}
              size="small"
              variant="outlined"
              onChange={handleMLChange}
              disabled={manualAction !== 'remove_waste'}
              className={classes.actionTextField}
              InputProps={{
                endAdornment: <InputAdornment position="end">mL</InputAdornment>,
              }}
            />
          </div>
        </RadioGroup>
      </FormControl>


      <div style={{display: "flex", marginTop: '5px'}}>
        <Button
          type="submit"
          variant="contained"
          size="small"
          color="primary"
          onClick={onSubmit}
          disabled={(mL === EMPTYSTATE) || formErrorML}
          style={{marginRight: '3px'}}
        >
          Adjust
        </Button>
      </div>
      <Snackbar
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        open={openSnackbar}
        onClose={handleSnackbarClose}
        message={snackbarMsg}
        autoHideDuration={7000}
        key={"snackbar" + props.unit}
      />
    </div>
  );
}