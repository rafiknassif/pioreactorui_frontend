import React, { useState, useEffect } from 'react';

import FormControl from '@mui/material/FormControl';
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import {Typography} from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/Card';
import SaveIcon from '@mui/icons-material/Save';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { Link } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Snackbar from '@mui/material/Snackbar';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-yaml'; // You can add more languages or change it


const EditExperimentProfilesContent = ({ code: initialCode, filename: initialFilename }) => {
  const DEFAULT_CODE = `experiment_profile_name:

metadata:
  description:
  author:
`;
  const DEFAULT_FILENAME = "";

  const [code, setCode] = useState(initialCode || DEFAULT_CODE);
  const [filename, setFilename] = useState(initialFilename || DEFAULT_FILENAME);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [isChanged, setIsChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onTextChange = newCode => {
    setCode(newCode);
    setIsChanged(true);
  };

  const onFilenameChange = e => {
    setFilename(e.target.value.replace(/ |\/|\.|\\/g, "_"));
    setIsChanged(true);
  };

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  const saveCurrentCode = () => {
    if (filename === "") {
      setIsError(true);
      setErrorMsg("Filename can't be blank");
      return;
    }

    setSaving(true);
    setIsError(false);
    setIsChanged(false);
    fetch("/api/contrib/experiment_profiles", {
      method: "POST",
      body: JSON.stringify({ body: code, filename: filename + '.yaml' }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (res.ok) {
          setSaving(false);
          setOpenSnackbar(true);
          setSnackbarMsg(`Experiment profile ${filename}.yaml saved.`);
        } else {
          res.json().then(parsedJson => {
            setErrorMsg(parsedJson['msg']);
            setIsError(true);
            setSaving(false);
            setIsChanged(true);
          });
        }
      });
  };

  return (
    <>
      <Grid container spacing={1}>
        <Grid item xs={6}>
          <div style={{ width: "100%", margin: "10px", display: "flex", justifyContent: "space-between" }}>
            <FormControl>
              <TextField
                label="Filename"
                onChange={onFilenameChange}
                required
                value={filename}
                style={{ width: "200px" }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">.yaml</InputAdornment>,
                }}
              />
            </FormControl>
          </div>
        </Grid>
        <Grid item xs={12}>
          <div style={{
            tabSize: "4ch",
            border: "1px solid #ccc",
            margin: "10px auto 10px auto",
            position: "relative",
            width: "98%",
            height: "330px",
            overflow: "auto",
            flex: 1
          }}>
            <Editor
              placeholder="Loading..."
              value={code}
              onValueChange={onTextChange}
              highlight={code => highlight(code, languages.yaml)}
              padding={10}
              style={{
                fontSize: "14px",
                fontFamily: 'monospace',
                backgroundColor: "hsla(0, 0%, 100%, .5)",
                borderRadius: "3px",
                minHeight: "100%"
              }}
            />
          </div>
        </Grid>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <Button
              variant="contained"
              color="primary"
              style={{ marginLeft: "20px", textTransform: 'none' }}
              onClick={saveCurrentCode}
              endIcon={<SaveIcon />}
              disabled={!isChanged}
            >
              Save
            </Button>
            <p style={{ marginLeft: "20px" }}>{isError ? <Box color="error.main">{errorMsg}</Box> : ""}</p>
          </div>
        </div>
      </Grid>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={openSnackbar}
        onClose={handleSnackbarClose}
        message={snackbarMsg}
        autoHideDuration={4000}
        key={"create-profile-snackbar"}
      />
    </>
  );
};

function ProfilesContainer(props){
  return(
    <React.Fragment>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: "bold" }}>
          Create Experiment Profile
        </Typography>
        <Button to={`/experiment-profiles`} component={Link} sx={{ textTransform: 'none' }}>
          <ArrowBackIcon sx={{ verticalAlign: "middle", mr: 0.5 }} fontSize="small"/> Back
        </Button>
      </Box>
      <Card sx={{marginTop: "15px"}}>
        <CardContent sx={{padding: "10px"}}>
          <EditExperimentProfilesContent />
          <p style={{textAlign: "center", marginTop: "30px"}}>Learn more about creating <a href="https://docs.pioreactor.com/user-guide/create-edit-experiment-profiles" target="_blank" rel="noopener noreferrer">experiment profile schemas</a>.</p>
        </CardContent>
      </Card>
    </React.Fragment>
)}


function CreateNewProfile(props) {

    React.useEffect(() => {
      document.title = props.title;
    }, [props.title]);
    return (
        <Grid container spacing={2} >
          <Grid item md={12} xs={12}>
            <ProfilesContainer />
          </Grid>
        </Grid>
    )
}

export default CreateNewProfile;
