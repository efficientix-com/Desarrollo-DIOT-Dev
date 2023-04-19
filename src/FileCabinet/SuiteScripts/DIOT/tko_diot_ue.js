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

            if ((context.type == context.UserEventType.VIEW || context.type == context.UserEventType.EDIT) && record_type == 'customrecord_tko_diot') {
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

                progress.defaultValue =`
                <script>
                console.log("holiiii");
                var estado=document.querySelector('[data-searchable-id="mainmaincustrecord_tko_estado_diot"] .uir-field.inputreadonly');
                var porcentaje=document.querySelector('[data-searchable-id="mainmaincustrecord_tko_porcentaje_diot"] .uir-field.inputreadonly');
                console.log('field de estado:',estado.textContent);
                var str=estado.textContent+"";
                console.log("STR:",str.trim());
                if(str.trim()=='Error'){

                    porcentaje.innerHTML='<progress class="error" id="progress" max="100" value="100"></progress>';
                }
                else if(str.trim()=='Pendiente...'){
                    porcentaje.innerHTML='<progress class="pending" id="progress" max="100" value="20"></progress>';
                }
                else if(str.trim()=='Obteniendo Datos...'){
                    porcentaje.innerHTML='<progress class="loading" id="progress" max="100" value="40"></progress>';
                }
                else if(str.trim()=='Validando Datos...'){
                    porcentaje.innerHTML='<progress class="validating" id="progress" max="100" value="60"></progress>';
                }
                else if(str.trim()=='Construyendo DIOT...'){
                    porcentaje.innerHTML='<progress class="building" id="progress" max="100" value="80"></progress>';
                }
                else if(str.trim()=='Completado'){
                    porcentaje.innerHTML='<progress class="success" id="progress" max="100" value="100"></progress>';
                }
                </script>
                <style>
                    #progress.error{
                        accent-color: #d61a1a;
                    }
                    #progress.success{
                        accent-color: #52bf90;
                    }
                    #progress.pending, #progress.loading, #progress.validating, #progress.building{
                        accent-color: #077cab;
                    }
                </style>
                `;
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
