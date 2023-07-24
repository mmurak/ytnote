// Copyright (C) Masaaki Murakami
/*
 * Globals
 */
class GlobalManager {
    constructor() {
        this.YTPlayer = null;
        this.seekPause = false; // It controls whether to pause or resume after a seek op.
        this.wholeArea = document.getElementById("wholeArea");
        this.idArea = document.getElementById("idArea");
        this.dataArea = document.getElementById("dataArea");
        this.descDialog = document.getElementById("descDialog");
        this.descVideoID = document.getElementById("descVideoID");
        this.descTime = document.getElementById("descTime");
        this.descField = document.getElementById("descField");
        this.editDialog = document.getElementById("editDialog");
        this.editVideoID = document.getElementById("editVideoID");
        this.editTime = document.getElementById("editTime");
        this.editField = document.getElementById("editField");
        this.editInMotionAt = null;
        this.inputIDButton = document.getElementById("inputIDButton");
        this.fileInputButton = document.getElementById("fileInputButton");
        this.playPauseButton = document.getElementById("playPauseButton");
        this.rewindSec = 2.0;

        this.descDialog.addEventListener("keydown", (e) => {
            if (e.key == "Escape") {
                descCancelButton();
                e.preventDefault();
            }
        });
        this.editDialog.addEventListener("keydown", (e) => {
            if (e.key == "Escape") {
                editCancelButton();
                e.preventDefault();
            }
        });

        this.wholeArea.addEventListener("keydown", (e) => {
            if ((window.getComputedStyle(document.getElementById("descDialog")).getPropertyValue("display") != "none") ||
                (window.getComputedStyle(document.getElementById("editDialog")).getPropertyValue("display") != "none")) {
                    return;
            }
            switch (e.key) {
                case "e" :
                case "E" :
                    rewind();
                    e.preventDefault();
                    break;
                case "q" :
                case "Q" :
                    playPause();
                    e.preventDefault();
                    break;
                case "i" :
                case "I" :
                    insertDescButton();
                    e.preventDefault();
                    break;
                case "s" :
                case "S" :
                    saveJSON();
                    e.preventDefault();
                    break;
            }
        });

        this.model = {};

    }
}

let G = new GlobalManager();

/*
 * YouTube iFrame API fiunctions
 */
function loadAPI() {
// Load API
    let scriptElement = document.createElement('script');
    scriptElement.id = "YouTubeIframeAPI";
    scriptElement.src = "https://www.youtube.com/iframe_api";
    let firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(scriptElement, firstScriptTag);
}

// Setup player (This function would be called by YouTube iFrame API)
function onYouTubeIframeAPIReady() {
    let width = document.documentElement.clientWidth - 25;
    width = (width > 640) ? 640 : width;
    const height = Math.round(width * 9 / 16);
    G.YTPlayer = new YT.Player('player', {
        height: height,
        width: width,
        controls: "1",
        events: {
            "onReady": onPlayerReady,
            "onStateChange": onPlayerStateChange,
        },
    });
    G.inputIDButton.disabled = false;
    G.fileInputButton.disabled = false;
}

function onPlayerReady(e) {
}

function onPlayerStateChange(e) {
    if (e.data == YT.PlayerState.PLAYING && G.seekPause) {
        G.seekPause = false;
        G.YTPlayer.pauseVideo();
    }
}

loadAPI();

function loadVideoAndSeek(vid, sec) {
    G.seekPause = true;
    G.YTPlayer.loadVideoById(
        {
            'videoId': vid,
            'startSeconds': sec,
//            'suggestedQuality': 'small'
        }
    );
}

function rewind() {
    const newTime = G.YTPlayer.getCurrentTime() - G.rewindSec;
    seekTo(newTime);
}

function enableControls() {
    const ctrls = document.getElementsByClassName("pcontrols");
    for(const e of ctrls) {
        e.disabled = false;
    }
}

function youtubeParser(url){  
// This regex was described on https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
    let regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    let match = url.match(regExp);
    return (match&&match[7].length==11)? match[7] : false;
}

/*
 * User Interface functions
 */
function loadVideoButton() {
    fileInputButton.value = "";
    let vid = prompt("Enter YouTube video identifier");
    if (vid.length != 11) {
        vid = youtubeParser(vid);
    }
    if (vid.length != 11) {
        alert("Video ID parse error. '" + vid + "'");
        return;
    }
    G.model["ID"] = vid;
    G.model["entry"] = [];
    G.idArea.innerHTML = vid;
    updateModel();
    loadVideoAndSeek(vid, 0);
    enableControls();
}

function seekTo(sec) {
    G.YTPlayer.seekTo(sec);
}

function playPause() { // from constructor of GlobalManager event setting
    if (G.YTPlayer.getPlayerState() == 1) {
        G.YTPlayer.pauseVideo();
    } else {
        G.YTPlayer.playVideo();
    }
}

function insertDescButton() {
    G.YTPlayer.pauseVideo();
    const ctime = Math.round(G.YTPlayer.getCurrentTime() * 100) / 100;
    const idx = findEntryIndex(ctime);
    if (idx < 0) {
        openDescDialog(ctime);
    } else {
        const pair = G.model["entry"][idx];
        G.editInMotionAt = idx;
        openEditDialog(pair["time"], pair["description"]);
    }
}

function findEntryIndex(time) {
    return G.model["entry"].findIndex((e) => { return e["time"] == time; });
}

function deleteButtonClicked(parm) {
    const sec = parm.target.id.substring(1);
    const idx = findEntryIndex(sec);
    if (idx < 0)  return;
    if (confirm("Can I delete this entry? (At " + sec + " sec.)")) {
        G.model["entry"].splice(idx, 1);
        updateModel();
    }
}

function editButtonClicked(parm) {
    const idx = findEntryIndex(parm.target.id.substring(1));
    const pair = G.model["entry"][idx];
    G.editInMotionAt = idx;
    openEditDialog(pair["time"], pair["description"]);
}

function newLine2BR(str) {
    str = str.replaceAll(" ", "&nbsp;");
    return str.replaceAll("\n", "<br/>");
}

function seconds2hhmmss(sec) {
    return new Date(sec * 1000).toISOString().slice(11, 22);
}

function updateModel() {
    while(G.dataArea.firstChild) {
        G.dataArea.removeChild(G.dataArea.lastChild);
    }
    let dataDict = G.model["entry"];
    let tdArray = dataDict.map((v) => { return [ v["time"], v["description"] ] });
    tdArray.sort((first, second) => { 
        const n1 = Number(first[0]);
        const n2 = Number(second[0]);
        if (n1 < n2) return -1;
        else if (n1 > n2) return 1;
        else return 0;
    });
    let aTable = document.createElement("table");
    aTable.class = "bodyTable";
    for (const pair of tdArray) {
        let aTR = document.createElement("tr");
        let aTD = document.createElement("td");
        let time = pair[0];
        let description = pair[1];
        // delete button
        let delButton = document.createElement("input");
        delButton.type = "button";
        delButton.value = "🗑️";
        delButton.id = "d" + time;
        delButton.onclick = deleteButtonClicked;
        aTD.appendChild(delButton);
        // edit button
        let editButton = document.createElement("input");
        editButton.type = "button";
        editButton.value = "✍️";
        editButton.id = "e" + time;
        editButton.onclick = editButtonClicked;
        aTD.appendChild(editButton);
        aTR.appendChild(aTD);
        // time column
        aTD = document.createElement("td");
        aDIV = document.createElement("div");
        aDIV.style = "font-size: 70%";
        aDIV.innerHTML = "[" + seconds2hhmmss(time) + "]: ";
        aTD.appendChild(aDIV);
        aTR.appendChild(aTD);
        // anchor tag
        aTD = document.createElement("td");
        let aTag = document.createElement("a");
        aTag.href = "javascript:seekTo(" + time + ");"
        aTag.innerHTML = newLine2BR(description) + "<br/>";
        aTD.appendChild(aTag);
        aTR.appendChild(aTD);
        aTable.appendChild(aTR);
    }
    G.dataArea.appendChild(aTable);
}

/*
 * File I/O functions
 */
function openJASON(input) {
    if (input.files.length != 1)  return;
    const filename = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
        G.model = JSON.parse(reader.result);
        G.idArea.innerHTML = G.model["ID"];
         loadVideoAndSeek(G.model["ID"], 0);
        updateModel();
        enableControls();
    }
    reader.readAsText(filename);
}

function saveJSON() {

    let dataDict = G.model["entry"];
    let tdArray = dataDict.map((v) => { return [ v["time"], v["description"] ] });
    tdArray.sort((first, second) => { 
        const n1 = Number(first[0]);
        const n2 = Number(second[0]);
        if (n1 < n2) return -1;
        else if (n1 > n2) return 1;
        else return 0;
    });
    let ddic = []
    for (const e of tdArray) {
        ddic.push({ "time" : e[0], "description" : e[1] });
    }
    G.model["entry"] = ddic;

    let jsonData = JSON.stringify(G.model);
    const blob = new Blob([jsonData],{type:"text/plain"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = G.model["ID"] + ".json";
    link.click();
}

/*
 * Dialog box functions
 */
function openDescDialog(ctime) {
    G.descTime.value = ctime;
    G.descField.value = "";
    G.descVideoID.innerHTML = G.model["ID"];
    G.descDialog.style.display = "block";
    G.descField.focus();
}

function descOkButton() {
    const descRetValue  = {"time" : G.descTime.value, "description" : G.descField.value};
    G.model["entry"].push(descRetValue);
    G.descDialog.style.display = "none";
    updateModel();
}
function descCancelButton() {
    G.descDialog.style.display = "none";
}

function openEditDialog(ctime, desc) {
    G.editTime.value = ctime;
    G.editField.value = desc;
    G.editVideoID.innerHTML = G.model["ID"];
    G.editDialog.style.display = "block";
    G.editField.focus();
}

function editOkButton() {
    G.model["entry"].splice([G.editInMotionAt], 1);
    const editRetValue  = {"time" : G.editTime.value, "description" : G.editField.value};
    G.model["entry"].push(editRetValue);
    G.editDialog.style.display = "none";
    updateModel();
}
function editCancelButton() {
    G.editInMotionAt = null;
    G.editDialog.style.display = "none";
}
