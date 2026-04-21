const roomCode = document.getElementById("roomCode");
const codeError = document.getElementById("codeError");
const enableCam = document.getElementById("enableCam");
const noCam = document.getElementById("noCam");
const videoBox = document.getElementById("videoBox");
const video = document.getElementById("video");

let useCamera = true;

/* TOGGLE OPTIONS */
enableCam.onclick = () => {
  enableCam.classList.add("active");
  noCam.classList.remove("active");
  useCamera = true;
};

noCam.onclick = () => {
  noCam.classList.add("active");
  enableCam.classList.remove("active");
  useCamera = false;
  stopCamera();
};

/* VALIDATION CODE SALLE */
roomCode.addEventListener("input", () => {
  if(roomCode.value.length !== 8){
    codeError.textContent = "Le code doit contenir exactement 8 caractères";
  } else {
    codeError.textContent = "";
  }
});

/* BOUTON REJOINDRE */
document.getElementById("joinBtn").onclick = async () => {

  if(roomCode.value.length !== 8){
    alert("Code de salle invalide (8 caractères requis)");
    return;
  }

  if(useCamera){
    const consent = confirm(
      "Autorisez-vous l’accès à la webcam pour la détection des émotions ?\n\n" +
      "Aucune image ne sera enregistrée."
    );

    if(!consent){
      alert("Veuillez utiliser le mode questionnaire.");
      return;
    }

    startCamera();
  } else {
    stopCamera();
    codeError.textContent = "Mode questionnaire activé. Vous pouvez continuer sans webcam.";
    setTimeout(() => {
      codeError.textContent = "";
    }, 2500);
  }
};

/* WEBCAM */
async function startCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:true });
    video.srcObject = stream;
    videoBox.classList.remove("hidden");
  }catch(e){
    alert("Impossible d’accéder à la webcam.");
  }
}

function stopCamera(){
  if(video.srcObject){
    video.srcObject.getTracks().forEach(t => t.stop());
  }
  videoBox.classList.add("hidden");
}

/* PRÊT POUR FACE-API.JS */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(() => {
  console.log("Face API prête");
});