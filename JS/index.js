function navigateToIntro() {
    window.location.href = 'introduction.html';
}

function navigateToSkills() {
    window.location.href = 'skills.html';
}

function navigateToGallery() {
    window.location.href = 'gallery.html';
}
function changeImage(newImageUrl, menuId) {
    var menuImage = document.getElementById(menuId);
    menuImage.src = newImageUrl;
}
window.onload = function() {
var isMac = navigator.platform.toUpperCase().indexOf('Mac') >= 0;
var video = document.getElementById('bg-video');

if(isMac){
    video.pause();
}
else{
    video.play();
}
}