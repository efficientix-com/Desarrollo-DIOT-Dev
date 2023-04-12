/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/url', 'N/currentRecord', 'N/ui/message', 'N/search', 'N/file', './tko_diot_constants_lib'],

function(url, currentRecord, message, search, file, values) {

    const INTERFACE = values.INTERFACE;
    const SCRIPTS_INFO = values.SCRIPTS_INFO;

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
            var currentForm = currentRecord.get();
            if ((scriptContext.fieldId == INTERFACE.FORM.FIELDS.SUBSIDIARIA.ID) || (scriptContext.fieldId == INTERFACE.FORM.FIELDS.PERIODO.ID)) {
                subsidiaria = currentForm.getValue({ fieldId: INTERFACE.FORM.FIELDS.SUBSIDIARIA.ID  });
                periodo = currentForm.getValue({ fieldId: INTERFACE.FORM.FIELDS.PERIODO.ID });
                
                console.log("Periodo", periodo);
                console.log("Subsidiaria", subsidiaria);

            }
        } catch (error) {
            console.error('error on fieldChange', error);
        }

    }

    /* function actualizarPantalla(){
        //location.reload();
        
        var currentForm = currentRecord.get();
        
        var datosRegistro = search.lookupFields({
            type: 'customrecord_tko_diot',
            id: 1,
            columns: ['custrecord_tko_subsidiaria_diot','custrecord_tko_periodo_diot','custrecord_tko_archivotxt_diot','custrecord_tko_estado_diot']
        });

        var subsidiariaRegistro = datosRegistro.custrecord_tko_subsidiaria_diot;
        var periodoRegistro = datosRegistro.custrecord_tko_periodo_diot;
        var archivoRegistro = datosRegistro.custrecord_tko_archivotxt_diot[0].value;
        var estadoRegistro = datosRegistro.custrecord_tko_estado_diot;
        
        console.log('Subsidiaria', subsidiariaRegistro);
        console.log('Periodo', periodoRegistro);
        console.log('Archivo', archivoRegistro);
        console.log('Estado', estadoRegistro);

        var output = url.resolveScript({
            scriptId: 'customscript_tko_diot_view_sl',
            deploymentId: 'customdeploy_tko_diot_view_sl',
            params: {
                'action': 'actualiza',
                "idArchivo": archivoRegistro
            },
            returnExternalUrl: false,
        });

        currentForm.setValue({
            fieldId: FIELD_ID.PANTALLA.SUBSIDIARIA,
            value: subsidiariaRegistro
        });
        currentForm.setValue({
            fieldId: FIELD_ID.PANTALLA.PERIODO,
            value: periodoRegistro
        }); */

        /* currentForm.setValue({
            fieldId: 'custpage_archivotxt',
            value: archivoRegistro
        }); 
            Valor concatenado asi:
            nlapiSetFieldValue("custpage_archivotxt","<a href='https://6736762-sbdr1.app.netsuite.com/core/media/media.nl?id=257887&c=6736762_SBDR1&h=VJdQi5sFwtvB6xZPybBm18wUOw7e6v68BEpu-ctiBg-6i3wc&_xt=.txt'> descargar </a>");
        */

        /* currentForm.setValue({
            fieldId: 'custpage_status',
            value: estadoRegistro
        });


        window.open(output, '_self');
    } */

    function generarReporte(oneWorld){

        if(oneWorld){ //si es oneWorld validar el campo de periodo y subsidiaria
            if(periodo && subsidiaria) {
                var msgbody = message.create({
                    type: message.Type.INFORMATION,
                    title: INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS.TITLE,
                    message: INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS.MESSAGE
                });
                var output = url.resolveScript({
                    scriptId: SCRIPTS_INFO.SUITELET.SCRIPT_ID,
                    deploymentId: SCRIPTS_INFO.SUITELET.DEPLOYMENT_ID,
                    params: {
                        'action': 'ejecuta',
                        [SCRIPTS_INFO.SUITELET.PARAMETERS.PERIOD]: periodo,
                        [SCRIPTS_INFO.SUITELET.PARAMETERS.SUBSIDIARY]: subsidiaria
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
                    title: INTERFACE.FORM.FIELDS.MESSAGE.ERROR.TITLE,
                    message: INTERFACE.FORM.FIELDS.MESSAGE.ERROR.MESSAGE
                });
                msgbody.show({ duration: 5000});
                console.log(false);
            }
        }else{ //si no es oneWorld solo valida el campo de periodo
            if(periodo){
                var msgbody = message.create({
                    type: message.Type.INFORMATION,
                    title: INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS.TITLE,
                    message: INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS.MESSAGE
                });
                var output = url.resolveScript({
                    scriptId: SCRIPTS_INFO.SUITELET.SCRIPT_ID,
                    deploymentId: SCRIPTS_INFO.SUITELET.DEPLOYMENT_ID,
                    params: {
                        'action': 'ejecuta',
                        [SCRIPTS_INFO.SUITELET.PARAMETERS.PERIOD]: periodo,
                        [SCRIPTS_INFO.SUITELET.PARAMETERS.SUBSIDIARY]: subsidiaria
                    },
                    returnExternalUrl: false,
                });
                msgbody.show({ duration: 5000});
                console.log(true);
                window.open(output, '_self');
            }else{
                var msgbody = message.create({
                    type: message.Type.ERROR,
                    title: INTERFACE.FORM.FIELDS.MESSAGE.ERROR.TITLE,
                    message: INTERFACE.FORM.FIELDS.MESSAGE.ERROR.MESSAGE
                });
                msgbody.show({ duration: 5000});
                console.log(false);
            }
        }
    }
    

    return {
        pageInit: pageInit,
        //actualizarPantalla:actualizarPantalla,
        generarReporte:generarReporte,
        fieldChanged: fieldChanged
    };

});