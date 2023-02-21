/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/url'],

function(url) {

    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {

    }

    function actualizarPantalla(){
        location.reload()
    }

    function generaDIOT(){
        console.log(true);
        var output = url.resolveScript({
            scriptId: 'customscript_tko_diot_view_sl',
            deploymentId: 'customdeploy_tko_diot_view_sl',
            params: {
                'action': 'ejecuta',
            },
            returnExternalUrl: false,
        });
        window.open(output, '_self');
    }

    return {
        pageInit: pageInit,
        actualizarPantalla:actualizarPantalla,
        generaDIOT:generaDIOT
    };

});
