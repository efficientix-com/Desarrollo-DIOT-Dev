/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/search', 'N/task', 'N/runtime'],
    /**
 * @param{log} log
 * @param{serverWidget} serverWidget
 */
    (log, serverWidget, search, task, runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var request = scriptContext.request, params = request.params, response = scriptContext.response
            try {
                let form = createUI(params);
                response.writePage({
                    pageObject: form
                });
            } catch (onRequestError) {
                log.error({ title: 'Error en onRequest', details: onRequestError })
            }
        }

        function createUI(params) {
            let form = serverWidget.createForm({
                title: 'Reporte DIOT'
            });
            form.clientScriptModulePath = './tko_diot_cs.js'

            try {
                /**
                 * *Creacion de los campos para los filtro de la DIOT
                 */

                form.addSubmitButton({
                    label: 'Generar',
                    functionName: 'generarReporte'
                });

                form.addButton({
                    id: "refresh",
                    label: "Actualizar",
                    functionName: "actualizarPantalla"
                });

                /**
                 * *Debe llenarse con las subsidiarias
                 */
                var subsidiaryList = form.addField({
                    id: "custpage_subsi",
                    type: serverWidget.FieldType.SELECT,
                    label: 'Subsidiaria'
                });

                var subsis = searchSubsidiaries();
                for (var sub = 0; sub < subsis.length; sub++) {

                    subsidiaryList.addSelectOption({
                        value: subsis[sub].id,
                        text: subsis[sub].name
                    });
                }

                /**
                 * *Debe llenarse con loa periodos contables
                 */
/*                 var accPeriod = form.addField({
                    id: "custpage_periodo",
                    type: serverWidget.FieldType.SELECT,
                    label: 'Periodo'
                });

                var periods = searchAccountingPeriod();
                for (let period = 0; period < periods.length; period++) {
                    accPeriod.addSelectOption({
                        value: periods[period].id,
                        text: periods[period].name
                    })
                } */

                /**
                 * Campo a llenar con el tipo de operación
                 */
                /* var operacionesList = form.addField({
                    id: 'custpage_operaciones',
                    type: serverWidget.FieldType.SELECT,
                    label: "Tipo de Operación"
                });

                var operaciones = searchOperationTypes();
                for (let operacion = 0; operacion < operaciones.length; operacion++) {
                    operacionesList.addSelectOption({
                        value: operaciones[operacion].id,
                        text: operaciones[operacion].name
                    })
                } */

                /**
                 * Se obtienen las transacciones que incurren en la generacion de impuestos
                 */
/*                 var facturas = searchVendorBill();
                var informes = searchExpenseReports();
                var polizas = searchDailyPolicy(); */

                /**
                 * !Aqui se realizaran las actualizaciones de los stages del MR
                 */
                var sublist = form.addSublist({
                    id: 'sublistid',
                    type: serverWidget.SublistType.LIST,
                    label: 'Status progress'
                });

                var archivo = sublist.addField({
                    id: 'txt',
                    label: 'Archivo TXT',
                    type: serverWidget.FieldType.TEXT,  //se cambio RICHTEXT por TEXT 
                });

            } catch (UIError) {
                log.error({ title: 'Error en createUI', details: UIError })
            }
            return form;
        }

        function searchSubsidiaries() {
            try {
                var subsidiaries = []
                var subsiSearch = search.create({
                    type: "subsidiary",
                    filters:
                        [
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            "internalid",
                            "name",
                            "city",
                            "state",
                            "country",
                            "currency",
                            "custrecord_company_uen",
                            "custrecord_company_brn"
                        ]
                });
                var searchResultCount = subsiSearch.runPaged().count;
                log.debug("subsidiarySearchObj result count", searchResultCount);
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
                            "periodname",
                            search.createColumn({
                                name: "internalid",
                                sort: search.Sort.ASC
                            })
                            // "internalid"
                        ]
                });
                var searchResultCount = aPeriod.runPaged().count;
                log.debug("accountingperiodSearchObj result count", searchResultCount);
                aPeriod.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'periodname' });

                    periods.push({
                        id: id,
                        name: name
                    })
                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchAccountingPeriod', details: error })
            }
            return periods
        }

        /**
         * Funcion para obtener el tipo de operaciones
         */
        function searchOperationTypes() {
            try {
                var operaciones = []
                var tipoOp = search.create({
                    type: 'customrecord_tko_tipo_operacion',
                    filters: 
                    [
                        ["isinactive", "is", "F"]
                    ],
                    columns:
                    [
                        "internalid", "name"
                    ]
                });
                var searchResultCount = tipoOp.runPaged().count;
                log.debug("operationTypesSearchObj result count", searchResultCount);
                tipoOp.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'name' });

                    operaciones.push({
                        id: id,
                        name: name
                    })
                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchOperationTypes', details: error })
            }
            return operaciones;
        }

        function generaDIOT() {
            var objTransacciones = {
                "custscript_tko_diot_subsidiary": '',
                "custscript_tko_diot_periodo": '',
            }
            for (var i = 1; i <= 10; i++) {
                var scriptdeploy_id = 'customdeploy_tko_genera_diot' + i;
                log.debug('scriptdeploy_id', scriptdeploy_id);

                var mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                mrTask.scriptId = 'customscript_tko_genera_diot';
                mrTask.deploymentId = scriptdeploy_id;
                mrTask.params = objTransacciones;

                try {
                    var mrTaskId = mrTask.submit();
                    log.debug("scriptTaskId tarea ejecutada", mrTaskId);
                    log.audit("Tarea ejecutada", mrTaskId);
                    break;
                }
                catch (e) {
                    log.debug({ title: "error", details: e });
                    log.error("summarize", "Aún esta corriendo el deployment: " + scriptdeploy_id);
                }
            }
        }

        return { onRequest }

    });
