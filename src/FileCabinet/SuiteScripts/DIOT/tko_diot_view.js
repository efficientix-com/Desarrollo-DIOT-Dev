/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/search'],
    /**
 * @param{log} log
 * @param{serverWidget} serverWidget
 */
    (log, serverWidget, search) => {
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
                for (let sub = 0; sub < subsis.length; sub++) {

                    subsidiaryList.addSelectOption({
                        value: subsis[sub].id,
                        text: subsis[sub].name
                    });
                }

                /**
                 * *Debe llenarse con loa periodos contables
                 */
                var accPeriod = form.addField({
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
                }

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
                    type: serverWidget.FieldType.RICHTEXT,
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

        return { onRequest }

    });
