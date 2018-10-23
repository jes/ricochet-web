// derived from https://www.w3schools.com/howto/howto_css_modals.asp

$('.open-modal').click(function(e) {
    $('#' + $(e.currentTarget).data('modal')).show();
    let focus = $(e.currentTarget).data('modal-focus');
    if (focus)
        $('#' + focus).focus();
});

$('.close-modal').click(function() {
    $('.modal').hide();
});

$(window).click(function(e) {
    if ($(e.target).hasClass('modal'))
        $('.modal').hide();
});
