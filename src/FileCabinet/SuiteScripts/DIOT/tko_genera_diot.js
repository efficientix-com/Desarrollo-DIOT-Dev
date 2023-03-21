/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url'],

    (runtime, search, url) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            try{

                var objScript = runtime.getCurrentScript();
                /** Se obtienen los parametros dados por el usuario */
                var subsidiaria = objScript.getParameter({ name: "custscript_tko_diot_subsidiary" });
                var periodo = objScript.getParameter({ name: "custscript_tko_diot_periodo" });
                
                log.audit({title: 'MR', details: "Se esta ejecutando el MR: getInputData"});
                var datos = [];
                datos.push({
                    'Subsidiaria': subsidiaria,
                    'Periodo': periodo
                })
                log.debug('Datos', datos);

                /** Se realiza la búsqueda de las distintas transacciones */
                var suitetax = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });
                log.audit({title: 'suitetax', details: suitetax});
                var facturasProv = searchVendorBill(subsidiaria, periodo, suitetax);
                var informesGastos = searchExpenseReports(subsidiaria, periodo, suitetax);
                var polizasDiario = searchDailyPolicy(subsidiaria, periodo, suitetax);

                /** Se ingresan los resultados de cada búsqueda en un arreglo */
                var resultados = [];
                resultados.push({
                    'Facturas': facturasProv,
                    'Informes': informesGastos,
                    'Polizas': polizasDiario
                });

                /** Verifica que las búsquedas no esten vacías */
                if(facturasProv.length == 0 && informesGastos.length == 0 && polizasDiario.length == 0) {
                    log.debug('Busquedas', 'No se encontaron transacciones en ese periodo');
                    // tener en cuenta que aqui se puede mandar ese texto en un key de objeto para manejar error directamente en el pantalla de la DIOT
                } else {
                    log.debug("Facturas", facturasProv);
                    log.debug("Informes", informesGastos);
                    log.debug("Polizas", polizasDiario);
                }

                return resultados;

            } catch (error) {
                log.error({ title: 'Error en la busqueda de transacciones', details: error })
            }

        }

        /**
         * Funcion para buscar las facturas de proveedores
         */
        function searchVendorBill(subsidiaria, periodo, suitetax){
            if (suitetax) {
                // cuando el motor es suite tax
                var facturas = [], creditoFacturas = [], idF = '';
                var facturaSearch = search.create({
                    type: "vendorbill",
                    filters:
                    [
                        //falta filtro tipo tercero y operacion
                        ["type","anyof","VendBill"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["status","anyof","VendBill:B"], 
                        "AND", 
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"]
                    ],
                    columns:
                    [
                        //falta columna tipo tercero, tipo operacion y codigo de impuesto
                        "internalid",
                        "type",
                        search.createColumn({
                            name: "entityid",
                            join: "vendor"
                        }),
                        "amount",
                        "netamount",
                        "taxtotal",
                        "total",
                        search.createColumn({
                            name: "taxcode",
                            join: "taxDetail"
                        }),
                        search.createColumn({
                            name: "taxtype",
                            join: "taxDetail"
                        })
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'entityid', join: "vendor" });
                    var impuestos = result.getValue({ name: 'taxtotal' });
                    var total = result.getValue({ name: 'total' });
                    var importe = total - impuestos;
                    var taxCode = result.getValue({ name: 'taxcode', join: 'taxDetail' });
                    var tipoImpuesto = result.getValue({ name: 'taxtype', join: 'taxDetail' });
                    var iva = 0, errores = '', columnaDiot = '';

                    //traer los datos de la fila que contenga todos
                    if (idF == id && taxCode != '' && tipoImpuesto != ''){
                        //iva = calculaIVA(impuestos,importe,iva);
                        //var datos = buscaDatos(proveedor, tipoTercero, errores); aun no se tiene el tipo de tercero
        
                        //Realizar la búsqueda después de agrupar
                        var credito = searchVendorCredit(proveedor, id, suitetax);
                        if (credito.length == 0){
                            credito = "";
                        }
        
                        /* var rfc = datos[0].rfc;
                        var taxID = datos[0].taxID;
                        var nombreExtranjero = datos[0].nombreExtranjero;
                        var paisResidencia = datos[0].paisResidencia;
                        var nacionalidad = datos[0].nacionalidad;
                        errores = datos[0].errores; */
                        
                        facturas.push({
                            id: id,
                            proveedor: proveedor,
                            importe: importe,
                            impuestos: impuestos,
                            taxCode: taxCode,
                            tipoImpuesto: tipoImpuesto,
                            credito: credito
                        });
                    }
                    
                    idF == id;

                    return true;
                });

                return facturas;

            } else {
                // cuando el motor es legacy
                var facturas = [], creditoFacturas = [];
                var facturaSearch = search.create({
                    type: "vendorbill",
                    filters:
                    [
                        ["type","anyof","VendBill"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["mainline","is","F"],
                        // "AND", 
                        // ["status","anyof","VendBill:B"], // (para pruebas, estado = pagado por completo)
                        "AND", 
                        ["account","anyof","186"],  
                        "AND", 
                        ["vendor.custentity_tko_diot_prov_type","anyof","1","2","3"], 
                        "AND", 
                        ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                        "AND", 
                        ["postingperiod","abs",periodo],
                        "AND", 
                        ["subsidiary","anyof",subsidiaria],
                        "AND", 
                        ["taxline","is","F"]
                    ],
                    columns:
                    [
                        "internalid",
                        "type",
                        search.createColumn({
                           name: "internalid",
                           join: "vendor",
                        }),
                        search.createColumn({
                           name: "custentity_tko_diot_prov_type",
                           join: "vendor"
                        }),
                        "custbody_tko_tipo_operacion",
                        "amount",
                        "netamountnotax",
                        "taxamount",
                        "taxcode",
                        search.createColumn({
                           name: "name",
                           join: "taxItem"
                        })
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'internalid', join: "vendor" });
                    var tipoTercero = result.getValue({ name: 'custentity_tko_diot_prov_type', join: "vendor" });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamountnotax' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getValue({ name: 'taxcode' });
                    var taxCodeName = result.getValue({ name: 'name', join: 'taxItem' });
                    var iva = 0, errores = '', columnaDiot = '';
    
                    iva = calculaIVA(impuestos,importe,iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
                    columnaDiot = codigoImpuesto(taxCode);
    
                    //Realizar la búsqueda después de agrupar
                    var credito = searchVendorCredit(proveedor, id, suitetax);
                    if (credito.length == 0){
                        credito = "";
                    }
    
                    var rfc = datos[0].rfc;
                    var taxID = datos[0].taxID;
                    var nombreExtranjero = datos[0].nombreExtranjero;
                    var paisResidencia = datos[0].paisResidencia;
                    var nacionalidad = datos[0].nacionalidad;
                    errores = datos[0].errores;
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        iva: iva,
                        importe: importe,
                        taxCode: taxCode,
                        taxCodeName: taxCodeName,
                        impuestos: impuestos,
                        columnaDiot: columnaDiot,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores,
                        credito: credito
                    });
    
                    return true;
                });
                return facturas;
                
            }
        }

        /**
         * Funcion para buscar los informes de gastos
         */
        function searchExpenseReports(subsidiaria, periodo, suitetax){

            if(suitetax){   //no se manejan informes de gastos
                var informes = [];
                var informesSearch = search.create({
                    type: "expensereport",
                    filters:
                    [
                        ["type","anyof","ExpRept"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["mainline","any",""], 
                        // "AND", 
                        // ["status","anyof","ExpRept:I"], (para prueba, estado = pagado por completo)
                        "AND", 
                        ["account","anyof","186"],   
                        "AND", 
                        ["custcol_tko_diot_prov_type","anyof","2","1","3"],
                        "AND",
                        ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                        "AND", 
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"]
                    ],
                    columns:
                    [
                        "internalid",
                        "type",
                        "custbody_tko_tipo_operacion",
                        "custcol_tko_diot_prov_type",
                        "custcol_tkio_proveedor",
                        "amount",
                        "netamountnotax",
                        "taxamount",
                        "taxcode",
                        search.createColumn({
                           name: "name",
                           join: "taxItem"
                        })
                    ]
                });

                informesSearch.run().each(function(result){

                    if(result.length != 0){
                        
                    }

                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'custcol_tkio_proveedor' });
                    var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamountnotax' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getValue({ name: 'taxcode' });
                    var taxCodeName = result.getValue({ name: 'name', join: 'taxItem' });
                    var iva = 0, errores = '', columnaDiot = '';
    
                    iva = calculaIVA(impuestos, importe, iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
                    columnaDiot = codigoImpuesto(taxCode);
    
                    var rfc = datos[0].rfc;
                    var taxID = datos[0].taxID;
                    var nombreExtranjero = datos[0].nombreExtranjero;
                    var paisResidencia = datos[0].paisResidencia;
                    var nacionalidad = datos[0].nacionalidad;
                    errores = datos[0].errores;
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        iva: iva,
                        importe: importe,
                        rfc: rfc,
                        taxID: taxID,
                        taxCode: taxCode,
                        taxCodeName: taxCodeName,
                        impuestos: impuestos,
                        columnaDiot: columnaDiot,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });
    
                return informes;     
            } else {
                var informes = [];
                var informesSearch = search.create({
                    type: "expensereport",
                    filters:
                    [
                        ["type","anyof","ExpRept"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["mainline","any",""], 
                        // "AND", 
                        // ["status","anyof","ExpRept:I"], (para prueba, estado = pagado por completo)
                        "AND", 
                        ["account","anyof","186"],   
                        "AND", 
                        ["custcol_tko_diot_prov_type","anyof","2","1","3"],
                        "AND",
                        ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                        "AND", 
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"]
                    ],
                    columns:
                    [
                        "internalid",
                        "type",
                        "custbody_tko_tipo_operacion",
                        "custcol_tko_diot_prov_type",
                        "custcol_tkio_proveedor",
                        "amount",
                        "netamountnotax",
                        "taxamount",
                        "taxcode",
                        search.createColumn({
                           name: "name",
                           join: "taxItem"
                        })
                    ]
                });
                informesSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'custcol_tkio_proveedor' });
                    var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamountnotax' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getValue({ name: 'taxcode' });
                    var taxCodeName = result.getValue({ name: 'name', join: 'taxItem' });
                    var iva = 0, errores = '', columnaDiot = '';
    
                    iva = calculaIVA(impuestos, importe, iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
                    columnaDiot = codigoImpuesto(taxCode);
    
                    var rfc = datos[0].rfc;
                    var taxID = datos[0].taxID;
                    var nombreExtranjero = datos[0].nombreExtranjero;
                    var paisResidencia = datos[0].paisResidencia;
                    var nacionalidad = datos[0].nacionalidad;
                    errores = datos[0].errores;
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        iva: iva,
                        importe: importe,
                        rfc: rfc,
                        taxID: taxID,
                        taxCode: taxCode,
                        taxCodeName: taxCodeName,
                        impuestos: impuestos,
                        columnaDiot: columnaDiot,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });
    
                return informes;
            }
        }

        /**
         * Funcion para buscar las polizas de diario
         */
        function searchDailyPolicy(subsidiaria, periodo, suitetax){

            if(suitetax){
                var polizas = []
                var polizasSearch = search.create({
                    type: "journalentry",
                    filters:
                    [
                        ["type","anyof","Journal"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["mainline","is","T"],
                        "AND", 
                        ["status","anyof","Journal:B"], 
                        "AND",
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"]
                    ],
                    columns:
                    [
                        "internalid",
                        "type",
                        "entity",
                        "amount",
                        "netamount",
                        "taxtotal",
                        "total"
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'entity' });
                    var importe = result.getValue({ name: 'netamount' });
                    var impuestos = result.getValue({ name: 'taxtotal' });
                    var total = result.getValue({ name: 'total' });
                    var iva = 0, errores = '', columnaDiot = '';

                    if(impuestos == ''){
                        impuestos = 0;
                    }
    
                    /* iva = calculaIVA(impuestos, importe, iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
                    columnaDiot = codigoImpuesto(taxCode);
    
                    var rfc = datos[0].rfc;
                    var taxID = datos[0].taxID;
                    var nombreExtranjero = datos[0].nombreExtranjero;
                    var paisResidencia = datos[0].paisResidencia;
                    var nacionalidad = datos[0].nacionalidad;
                    errores = datos[0].errores; */
    
                    polizas.push({
                        id: id,
                        proveedor: proveedor,
                        importe: importe,
                        impuestos: impuestos
                    })
                    return true;
                });
    
                return polizas;
            }else {
                var polizas = []
                var polizasSearch = search.create({
                    type: "journalentry",
                    filters:
                    [
                        ["type","anyof","Journal"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["mainline","any",""],
                        "AND", 
                        ["status","anyof","Journal:B"], 
                        "AND", 
                        ["account","anyof","186"], 
                        "AND", 
                        ["custcol_tko_diot_prov_type","anyof","1","2","3"], 
                        "AND", 
                        ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                        "AND", 
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"]
                    ],
                    columns:
                    [
                        "internalid",
                        "type",
                        "account",
                        "custcol_tko_diot_prov_type",
                        "custbody_tko_tipo_operacion",
                        "custcol_tkio_proveedor",
                        "amount",
                        "netamountnotax",
                        "taxamount",
                        "taxcode",
                        search.createColumn({
                           name: "name",
                           join: "taxItem"
                        })
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'custcol_tkio_proveedor' });
                    var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamountnotax' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getValue({ name: 'taxcode' });
                    var taxCodeName = result.getValue({ name: 'name', join: 'taxItem' });
                    var iva = 0, errores = '', columnaDiot = '';
    
                    iva = calculaIVA(impuestos, importe, iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
                    columnaDiot = codigoImpuesto(taxCode);
    
                    var rfc = datos[0].rfc;
                    var taxID = datos[0].taxID;
                    var nombreExtranjero = datos[0].nombreExtranjero;
                    var paisResidencia = datos[0].paisResidencia;
                    var nacionalidad = datos[0].nacionalidad;
                    errores = datos[0].errores;
    
                    polizas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        iva: iva,
                        importe: importe,
                        rfc: rfc,
                        taxID: taxID,
                        taxCode: taxCode,
                        taxCodeName: taxCodeName,
                        impuestos: impuestos,
                        columnaDiot: columnaDiot,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    })
                    return true;
                });

                return polizas;
            }
        }

        /**
         * Función que calcula el IVA de cada operación realizada en las distintas transacciones
         * @param {*} impuestos Cantidad o total de impuestos aplicados en dicha operación
         * @param {*} importe Importe de la operación
         * @param {*} iva Iva = 0, para hacer el cálculo de manera correcta cada que se invoque la función
         * @returns {*} El IVA con el cuál fue calculado dicha operación
         */
        function calculaIVA(impuestos, importe, iva){
            if (impuestos != 0 || impuestos != '') {
                iva = (impuestos * 100) / importe;
            } else {
                iva = 0;
            }
            if(iva < 0){
                iva = iva * -1;
            }

            return iva;
        }

        /**
         * Función que realiza la búsqueda de distintos campos de acuerdo a cada proveedor
         * @param {*} proveedor Proveedor obtenido de cada operación
         * @param {*} tipoTercero Tipo de tercero del proveedor
         * @param {*} errores Errores que se almacenan de acuerdo a las validaciones
         * @returns Los valores de los campos obtenidos y los errores encontrados
         */
        function buscaDatos(proveedor, tipoTercero, errores){

            var error = '', resultados = [];
            var datos = search.lookupFields({
                type: search.Type.VENDOR,
                id: proveedor,
                columns: ['custentity_mx_rfc', 'custentity_efx_fe_numregidtrib' , 'custentity_tko_nombre_extranjero', 'custentity_tko_pais_residencia', 'custentity_tko_nacionalidad']
            });

            var rfc = datos.custentity_mx_rfc;
            var taxID = datos.taxidnum;
            var nombreExtranjero = datos.custentity_tko_nombre_extranjero;
            var paisResidencia = datos.custentity_tko_pais_residencia;
            if(paisResidencia.length != 0){
                var paisText = paisResidencia[0].text;
                paisResidencia = paisText;
            }else {
                paisResidencia = "";
            }
            var nacionalidad = datos.custentity_tko_nacionalidad;

            if (tipoTercero == 1){ //si es proveedor nacional -> RFC obligatorio
                if(rfc == ''){
                    error = "El proveedor " + proveedor + " no tiene asignado el RFC";
                    errores = errores + error + ", ";
                }
                /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                taxID = "";
                nombreExtranjero = "";
                paisResidencia = "";
                nacionalidad = "";
            } else if (tipoTercero == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                if(taxID == ''){
                    error = "El proveedor " + proveedor + " no tiene asignado el número de ID Fiscal";
                    errores = errores + error + ", ";
                }
                /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                if (nombreExtranjero != ""  && paisResidencia == ""){
                    error = "El proveedor " + proveedor + " no tiene asignado el pais de residencia";
                    errores = errores + error + ", ";
                }
                if(nombreExtranjero != "" && nacionalidad == ""){
                    error = "El proveedor " + proveedor + " no tiene asignada la nacionalidad";
                    errores = errores + error + ", ";
                }
                /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                if(nombreExtranjero == ""){ 
                    paisResidencia = "";
                    nacionalidad = "";
                }
            } else { //si es proveedor global -> RFC NO obligatorio
                /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                rfc = "";
                taxID = "";
                nombreExtranjero = "";
                paisResidencia = "";
                nacionalidad = "";
            }

            resultados. push({
                rfc: rfc,
                taxID, taxID,
                nombreExtranjero: nombreExtranjero,
                paisResidencia: paisResidencia,
                nacionalidad: nacionalidad,
                errores: errores
            });

            return resultados;
        }

        /**
         * Funcion que evalúa a que columna pertenece en el txt de acuerdo al código de impuesto
         * @param {*} taxCode código de impuesto a evaluar
         * @returns Número de columna al que pertenece
         */
        function codigoImpuesto(taxCode) {

            var columna = "";

            if(taxCode == 1017){ //IVA 16
                columna = 8;
            }else if(taxCode == 1026){ //R-MX
                columna = 13;
            } else if(taxCode == 1022){ //IS-MX
                columna = 16;
            } else if(taxCode == 1027){ //IR-MX
                columna = 18;
            } else if(taxCode == 1024){ //IE-MX
                columna = 20;
            } else if(taxCode == 1020){ //Z-MX
                columna = 21;
            } else if(taxCode == 1021){ //E-MX
                columna = 22;
            } else if(taxCode == 1032 || taxCode == 1063){ //IVA 8 || RESICO 1.25
                columna = 23;
            } else {
                columna = 0;
            }

            return columna;
        }

        /**
         * Funcion que hace una búsqueda de devoluciones o bonificaciones de algún proveedor
         */
        function searchVendorCredit(proveedor, idFactProv, suitetax){
            if(suitetax){
                var credito = [], proveedorC = '', idFact = '', idC = '';
                var creditSearch = search.create({
                    type: "vendorcredit",
                    filters:
                    [
                       ["type","anyof","VendCred"], 
                       "AND", 
                       ["voided","is","F"],
                       "AND", 
                       ["taxline","is","F"], 
                       "AND", 
                       ["vendor.internalid","anyof",proveedor], 
                       "AND", 
                       ["appliedtotransaction.internalid","anyof",idFactProv]
                    ],
                    columns:
                    [
                       "internalid",
                       "entity",
                       "amount",
                       "netamount",
                       "taxtotal",
                       "total",
                       search.createColumn({
                          name: "internalid",
                          join: "appliedToTransaction"
                       }),
                       search.createColumn({
                          name: "taxcode",
                          join: "taxDetail"
                       }),
                       search.createColumn({
                          name: "taxtype",
                          join: "taxDetail"
                       }),
                    ]
                });
                creditSearch.run().each(function(result){
                    
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'entity' });
                    var idFactura = result.getValue({ name: 'internalid', join: 'appliedToTransaction' });
                    var impuesto = result.getValue({ name: 'taxtotal' });
                    var total = result.getValue({ name: 'total' });
                    var taxCode = result.getValue({ name: 'taxcode', join: 'taxDetail' });
                    var tipoImpuesto = result.getValue({ name: 'taxtype', join: 'taxDetail' });
                    var importe = total - impuesto;

                    if (proveedor != '' || idFactura != ''){
                        proveedorC = proveedor;
                        idFact = idFactura;
                    }

                    if (idC == id && taxCode != '' && tipoImpuesto != ''){
                        credito.push({
                            id: id,
                            proveedor: proveedorC,
                            idFactura: idFact,
                            importe: importe,
                            impuesto: impuesto,
                            taxCode: taxCode,
                            tipoImpuesto: tipoImpuesto
                        });
                    }

                    idC = id;
                    
                    return true;
                });
                
                return credito;
            }else{
                var credito = [];
                var creditSearch = search.create({
                    type: "vendorcredit",
                    filters:
                    [
                       ["type","anyof","VendCred"], 
                       "AND", 
                       ["voided","is","F"], 
                       "AND", 
                       ["mainline","is","F"], 
                       "AND", 
                       ["taxline","is","F"], 
                       "AND", 
                       ["vendor.internalid","anyof",proveedor], 
                       "AND", 
                       ["appliedtotransaction.internalid","anyof",idFactProv]
                    ],
                    columns:
                    [
                       "internalid",
                       search.createColumn({
                          name: "entityid",
                          join: "vendor"
                       }),
                       "custbody_tko_tipo_operacion",
                       search.createColumn({
                          name: "custentity_tko_diot_prov_type",
                          join: "vendor"
                       }),
                       search.createColumn({
                          name: "internalid",
                          join: "appliedToTransaction"
                       }),
                       "account",
                       "amount",
                       "netamountnotax",
                       "taxamount",
                       "taxcode"
                    ]
                });
                creditSearch.run().each(function(result){
                    
                    var id = result.getValue({ name: 'internalid' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var tipoTercero = result.getValue({ name: 'custentity_tko_diot_prov_type', join: 'vendor' });
                    var idFactura = result.getValue({ name: 'internalid', join: 'appliedToTransaction' });
                    var importe = result.getValue({ name: 'netamountnotax' });
                    var impuesto = result.getValue({ name: 'taxamount' });
    
                    credito.push({
                        id: id,
                        proveedor: proveedor,
                        tipoOperacion:tipoOperacion,
                        tipoTercero: tipoTercero,
                        idFactura: idFactura,
                        importe: importe,
                        impuesto: impuesto
                    });
                    
                    return true;
                });
                
                return credito; 
            }
        }
        
        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {

            try{
                var results = mapContext.value;
                //log.debug('Resultados de getInput', results);


            }catch(error){
                log.error({ title: 'Error en el Map', details: error });
            }
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {

            /* log.debug('Summary Time', summaryContext.seconds);
            log.debug('Summary Usage', summaryContext.usage);
            log.debug('Summary Yields', summaryContext.yields);

            log.debug('Input Summary', summaryContext.inputSummary);
            log.debug('Map Summary', summaryContext.mapSummary);
            log.debug('Reduce Summary', summaryContext.reduceSummary); */

        }


        return {getInputData, map, reduce, summarize};

    });
