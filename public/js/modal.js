// https://www.w3schools.com/howto/howto_css_modals.asp
modal = document.getElementById('add-contact-modal');

// Get the button that opens the modal
var btn = document.getElementById("add-contact");

// Get the <span> element that closes the modal
var closers = document.getElementsByClassName("close-modal");

// When the user clicks on the button, open the modal
btn.onclick = function() {
    modal.style.display = "block";
}

for (i in closers) {
    // When the user clicks on <span> (x), close the modal
    closers[i].onclick = function() {
        modal.style.display = "none";
    }
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
} 
