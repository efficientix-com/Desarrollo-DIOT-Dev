/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/url', 'N/currentRecord', 'N/ui/message'],

function(url, currentRecord, message) {

    
    var periodo, subsidiaria;

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


    function fieldChanged(scriptContext) {
        try {
            let currentForm = currentRecord.get();
            if ((scriptContext.fieldId == 'custpage_subsi') || (scriptContext.fieldId == 'custpage_period')) {
                subsidiaria = currentForm.getValue({ fieldId: "custpage_subsi" });
                periodo = currentForm.getValue({ fieldId: "custpage_period" });
                
                console.log("Periodo", periodo);
                console.log("Subsidiaria", subsidiaria);

            }
        } catch (error) {
            console.error('error on fieldChange', error);
        }

    }

    function actualizarPantalla(){
        location.reload();
        var output = url.resolveScript({
            scriptId: 'customscript_tko_diot_view_sl',
            deploymentId: 'customdeploy_tko_diot_view_sl',
            params: {
                'action': 'actualiza',
            },
            returnExternalUrl: false,
        });
        window.open(output, '_self');
    }

    function generarReporte(){

        if(periodo && subsidiaria) {
            var msgbody = message.create({
                type: message.Type.INFORMATION,
                title: "Datos procesados",
                message: "Se esta generando el reporte DIOT"
            });
            var output = url.resolveScript({
                scriptId: 'customscript_tko_diot_view_sl',
                deploymentId: 'customdeploy_tko_diot_view_sl',
                params: {
                    'action': 'ejecuta',
                    "periodo": periodo,
                    "subsidiaria": subsidiaria
                },
                returnExternalUrl: false,
            });
            msgbody.show({ duration: 5000});
            console.log(true);
            window.open(output, '_self');
        }
        else {
            var msgbody = message.create({
                type: message.Type.ERROR,
                title: "Datos incompletos",
                message: "Asegurese de llenar todos los campos de la pantalla"
            });
            msgbody.show({ duration: 5000});
            console.log(false);
        }
    }
    

    return {
        pageInit: pageInit,
        actualizarPantalla:actualizarPantalla,
        generarReporte:generarReporte,
        fieldChanged: fieldChanged
    };

});
