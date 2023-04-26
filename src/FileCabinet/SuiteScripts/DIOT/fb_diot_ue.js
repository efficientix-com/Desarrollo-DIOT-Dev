/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/task', 'N/search', './fb_diot_constants_lib'],
    /**
 * @param{record} record
 * @param{runtime} runtime
 */
    (record, runtime, task, search, values) => {

        const INTERFACE = values.INTERFACE;
        const RECORD_INFO = values.RECORD_INFO;
        const SCRIPTS_INFO = values.SCRIPTS_INFO;

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
            try{
                var nRecord = context.newRecord;
                var taskId = nRecord.getValue({ fieldId: RECORD_INFO.DIOT_RECORD.FIELDS.TASK_ID });
                var record_type = nRecord.type;
    
                if (context.type == context.UserEventType.VIEW && record_type == RECORD_INFO.DIOT_RECORD.ID) {
                    var form = context.form;
                    // se agrega el CS para traer funciones de allá
                    form.clientScriptModulePath = "./" + SCRIPTS_INFO.CLIENT.FILE_NAME;
    
                    // se agrega el boton de actualizar
                    form.addButton({
                        id: INTERFACE.FORM.BUTTONS.ACTUALIZAR.ID,
                        label: INTERFACE.FORM.BUTTONS.ACTUALIZAR.LABEL,
                        functionName: INTERFACE.FORM.BUTTONS.ACTUALIZAR.FUNCTION
                    });
    
                    // se quita el boton de editar
                    form.removeButton({
                        id: INTERFACE.FORM.BUTTONS.EDITAR.ID
                    });

                    //Se va calculando el porcentaje dependiendo la etapa en la que va del map reduce
                    var percent = updatePercent(taskId, nRecord);
    
    
                }
            }catch(error){
                log.error({ title: 'Error on beforeLoad', details: error });
            }

        }

        function updatePercent(taskId, nRecord){
            try{
                var taskStatus = task.checkStatus({
                    taskId: taskId
                });
                var percent = 0;
                switch(taskStatus.stage){
                    case task.MapReduceStage.GET_INPUT:
                        percent += 0;
                        break;
                    case task.MapReduceStage.MAP:
                        percent += 0;
                        break;
                    case task.MapReduceStage.SHUFFLE:
                        percent += 0;
                        break;
                    case task.MapReduceStage.REDUCE:
                        percent += 40;
                        break;
                    case task.MapReduceStage.SUMMARIZE:
                        percent += 80;
                        break;
                }
                var completion = taskStatus.getPercentageCompleted();
                if( !taskStatus.stage){
                    percent = 100;
                }
                else{
                    percent += (completion * 20) / 100;
                }
    
                record.submitFields({
                    type: nRecord.type,
                    id: nRecord.id,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.PROGRESS]: Math.round(percent * 100) / 100 + '%'
                    }
                });

               return percent;
    
            }
            catch(e){
                log.error("updatePercent e", e);
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
