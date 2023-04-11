/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/search', 'N/task', 'N/runtime', './tko_diot_constants_lib'],
    /**
 * @param{log} log
 * @param{serverWidget} serverWidget
 */
    (log, serverWidget, search, task, runtime, values) => {

        const FIELD_ID = values.FIELD_ID;
        const INTERFACE = values.INTERFACE;
        const RECORD_INFO = values.RECORD_INFO;
        const SCRIPTS_INFO = values.SCRIPTS_INFO;
        const RUNTIME = values.RUNTIME;

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var request = scriptContext.request, response = scriptContext.response;
            var parameters = request.parameters;

            try {
                let form = createUI(parameters);
                response.writePage({
                    pageObject: form
                });
                switch(parameters.action){
                    case 'ejecuta':
                        generaDIOT(parameters.subsidiaria, parameters.periodo);
                        break;
                    /* case 'actualiza':
                        log.debug("prueba", "Click en botón actualiza");
                        llenarDatos(parameters.idArchivo);
                        log.debug('ID Archivo', parameters.idArchivo);
                        break; */
                }
            } catch (onRequestError) {
                log.error({ title: 'Error en onRequest', details: onRequestError })
            }
        }

        function createUI(parameters) {
            let form = serverWidget.createForm({
                title: INTERFACE.FORM.TITLE
            });
            form.clientScriptModulePath = './'+SCRIPTS_INFO.CLIENT.FILE_NAME;

            //Verificar si la empresa es one world
            var oneWorldFeature = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUBSIDIARIES });
            log.debug('OneWorld', oneWorldFeature);

            try {
                /**
                 * Creacion de los campos para los filtros de la DIOT
                 */

                /* form.addButton({
                    id: "refresh",
                    label: "Actualizar",
                    functionName: "actualizarPantalla"
                }); */

                form.addButton({
                    id: INTERFACE.FORM.BUTTONS.GENERAR.ID,
                    label: INTERFACE.FORM.BUTTONS.GENERAR.LABEL,
                    functionName: INTERFACE.FORM.BUTTONS.GENERAR.FUNCTION + '(' + oneWorldFeature + ')'
                });
                log.debug( "parameters", parameters );

                var fieldgroup_datos = form.addFieldGroup({
                    id : FIELD_ID.PANTALLA.GRUPO_DATOS,
                    label : 'Datos'
                });

                /**
                 * Lista de subsidiarias
                 */
                var subsidiaryList = form.addField({
                    id: FIELD_ID.PANTALLA.SUBSIDIARIA,
                    type: serverWidget.FieldType.SELECT,
                    label: 'Subsidiaria',
                    container: FIELD_ID.PANTALLA.GRUPO_DATOS
                });

                /* var user = runtime.getCurrentUser();
                log.debug('EmpresaSubsi', user.subsidiary); */

                if(oneWorldFeature){ //si es oneWorld hace la búsqueda de las subsidiarias
                    var subsis = searchSubsidiaries();
                    subsidiaryList.addSelectOption({ value: '', text: '' });
                    for (var sub = 0; sub < subsis.length; sub++) {
    
                        subsidiaryList.addSelectOption({
                            value: subsis[sub].id,
                            text: subsis[sub].name
                        });
                    }
                }else{ //si no es oneWorld se bloquea el campo
                    subsidiaryList.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.DISABLED
                    });
                }


                /**
                 * Lista de periodos
                 */
                var periodList = form.addField({
                    id: FIELD_ID.PANTALLA.PERIODO,
                    type: serverWidget.FieldType.SELECT,
                    label: "Periodo Contable",
                    container: FIELD_ID.PANTALLA.GRUPO_DATOS
                });

                var periods = searchAccountingPeriod();
                periodList.addSelectOption({ value: '', text: '' });
                for (var per = 0; per < periods.length; per++) {

                    periodList.addSelectOption({
                        value: periods[per].id,
                        text: periods[per].name
                    });
                }

            } catch (UIError) {
                log.error({ title: 'Error en createUI', details: UIError })
            }
            return form;
        }

        function searchSubsidiaries() {
            try {
                var subsidiaries = []
                var subsiSearch = search.create({
                    type: RECORD_INFO.SUBSIDIARY_RECORD.ID,
                    filters:
                        [
                            [RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.INACTIVE, search.Operator.IS, "F"]
                        ],
                    columns:
                        [
                            RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.ID,
                            RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.NAME
                        ]
                });
                subsiSearch.run().each(function (result) {
                    var id = result.getValue({ name: RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.ID });
                    var name = result.getValue({ name: RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.NAME });

                    subsidiaries.push({
                        id: id,
                        name: name
                    });
                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchSubsidiaries', details: error });
            }
            return subsidiaries;
        }

        function searchAccountingPeriod() {
            try {
                var periods = []
                var aPeriod = search.create({
                    type: RECORD_INFO.ACCOUNTINGPERIOD_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.INACTIVE, search.Operator.IS, "F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.ID,
                        RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.NAME,
                        search.createColumn({
                            name: RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.ID,
                            sort: search.Sort.DESC
                        })
                    ]
                });
                aPeriod.run().each(function (result) {
                    var id = result.getValue({ name: RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.ID });
                    var name = result.getValue({ name: RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.NAME });

                    periods.push({
                        id: id,
                        name: name
                    });

                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchAccountingPeriod', details: error });
            }
            return periods;
        }

        function generaDIOT(subsidiaria, periodo) {
            try {

                //Crear el registro

                var mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: SCRIPTS_INFO.MAP_REDUCE.SCRIPT_ID,
                    deploymentId: SCRIPTS_INFO.MAP_REDUCE.DEPLOYMENT_ID,
                    params: {
                        [SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY]: subsidiaria,
                        [SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD]: periodo
                    }
                });
                var idTask = mrTask.submit();
                log.audit({ title: 'idTask', details: idTask });
            }
            catch (e) {
                log.debug({ title: "Error", details: e });
                //log.error({ title: 'Execution Error', details: "Aun esta corriendo la ejecución"});
            }
        }

        return { onRequest }

    });
