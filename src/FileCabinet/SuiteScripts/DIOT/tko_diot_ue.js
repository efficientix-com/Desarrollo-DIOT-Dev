/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime'],
    /**
 * @param{record} record
 * @param{runtime} runtime
 */
    (record, runtime) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (context) => {
            var nRecord = context.newRecord;
            var record_type = nRecord.type;

            if (context.type == context.UserEventType.VIEW && record_type == 'customrecord_tko_diot') {
                var form = context.form;
                // se agrega el CS para traer funciones de allá
                form.clientScriptModulePath = "./tko_diot_cs.js";

                // se agrega el boton de actualizar
                form.addButton({
                    id: "custpage_btn_reload_page",
                    label: "Actualizar",
                    functionName: "actualizarPantalla"
                });

                var progress = form.addField({
                    id:'custpage_progress',
                    type: 'INLINEHTML',
                    label: 'code'
                });

                progress.defaultValue ='';
            }

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
