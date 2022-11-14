/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget'],
    /**
 * @param{log} log
 * @param{serverWidget} serverWidget
 */
    (log, serverWidget) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var request = scriptContext.request, params = request.params, response = scriptContext.response
            try{
                let form = createUI(params);
                response.writePage({
                    pageObject: form
                });
            }catch(onRequestError){
                log.error({title: 'Error en onRequest', details: onRequestError})
            }
        }

        function createUI(params){
            let form = serverWidget.createForm({
                title: 'Reporte DIOT'
            });
            form.clientScriptModulePath = './tko_diot_cs.js'

            try {
                /**
                 * *Creacion de los campos para los filtro de la DIOT
                 */
-
                form.addButton({
                    id: "custpage_refresh",
                    label: "Actualizar",
                    functionName:"actualizarPantalla"
                });

                form.addField({
                    id: "custpage_test",
                    type: serverWidget.FieldType.TEXT,
                    label: 'Filtro para DIOT'
                });

                form.addField({
                    id: "custpage_test",
                    type: serverWidget.FieldType.TEXT,
                    label: 'Segundo filtro para DIOT'
                });

                form.addField({
                    id: "custpage_test",
                    type: serverWidget.FieldType.TEXT,
                    label: 'Tercer filtro para DIOT'
                });

                form.addField({
                    id: "custpage_test",
                    type: serverWidget.FieldType.TEXT,
                    label: 'Cuarto filtro para DIOT'
                });

            } catch (UIError) {
                log.error({title: 'Error en createUI', details: UIError})
            }
            return form;
        }

        return {onRequest}

    });
