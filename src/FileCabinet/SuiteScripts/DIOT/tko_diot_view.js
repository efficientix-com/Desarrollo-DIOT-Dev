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
                        log.debug("prueba", "Click en botón generar");
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
                title: 'Reporte DIOT'
            });
            form.clientScriptModulePath = './tko_diot_cs.js'

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
                    id: "btn_generar_diot",
                    label: "Generar",
                    functionName: "generarReporte"
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

                var subsis = searchSubsidiaries();
                subsidiaryList.addSelectOption({ value: '', text: '' });
                for (var sub = 0; sub < subsis.length; sub++) {

                    subsidiaryList.addSelectOption({
                        value: subsis[sub].id,
                        text: subsis[sub].name
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
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            "internalid",
                            "name",
                            "city"
                        ]
                });
                subsiSearch.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'name' });
                    var city = result.getValue({ name: 'city' });

                    subsidiaries.push({
                        id: id,
                        name: name,
                        city: city
                    });
                    return true;
                });
            } catch (searchError) {
                log.error({ title: 'Error on searchSubsidiaries', details: searchError })
            }
            return subsidiaries
        }

        function searchAccountingPeriod() {
            try {
                var periods = []
                var aPeriod = search.create({
                    type: "accountingperiod",
                    filters:
                        [
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            "internalid",
                            "periodname",
                            search.createColumn({
                                name: "internalid",
                                sort: search.Sort.DESC
                            })
                        ]
                });
                // var searchResultCount = aPeriod.runPaged().count;
                // log.debug("accountingperiodSearchObj result count", searchResultCount);
                aPeriod.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'periodname' });

                    periods.push({
                        id: id,
                        name: name
                    });

                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchAccountingPeriod', details: error })
            }
            return periods;
        }

        function generaDIOT(subsidiaria, periodo) {
            try {

                //Crear el registro

                var mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_tko_generate_diot_mr',
                    deploymentId: 'customdeploy_tko_diot_generate_1',
                    params: {
                        'custscript_tko_diot_subsidiary': subsidiaria,
                        'custscript_tko_diot_periodo': periodo
                    }
                });
                var idTask = mrTask.submit();
                log.audit({ title: 'idTask', details: idTask });
            }
            catch (e) {
                log.debug({ title: "Error", details: e });
                log.error({ title: 'Execution Error', details: "Aun esta corriendo la ejecución"});
            }
        }

        /* function llenarDatos(idArchivo) {
            var fileObj = file.load({
                id: archivoRegistro
            });
            console.log('File', fileObj);
            var url = fileObj.url;
            console.log('URL:', url);
        } */

        return { onRequest }

    });
