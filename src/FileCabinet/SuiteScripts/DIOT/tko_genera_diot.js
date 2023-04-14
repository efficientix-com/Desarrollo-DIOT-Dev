/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', 'N/record', 'N/file', 'N/redirect', 'N/config', './tko_diot_constants_lib'],

    (runtime, search, url, record, file, redirect, config, values) => {
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

        var taxRateArray = new Array();

        const SCRIPTS_INFO = values.SCRIPTS_INFO;
        const RECORD_INFO = values.RECORD_INFO;
        const RUNTIME = values.RUNTIME;
        const COMPANY_INFORMATION = values.COMPANY_INFORMATION;

        const getInputData = (inputContext) => {
            try{

                /** Se obtienen los parametros dados por el usuario */
                var objScript = runtime.getCurrentScript();
                var subsidiaria = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY });
                var periodo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD });
                //log.debug('Datos', subsidiaria + " " + periodo);

                /** Se crea un registro para guardar los datos de la pantalla del suitelet */
                /* var registroDIOT = record.load({
                    type: 'customrecord_tko_diot',
                    id: 1, 
                });

                registroDIOT.setValue({
                    fieldId: 'custrecord_tko_periodo_diot',
                    value: periodo
                });
                
                registroDIOT.setValue({
                    fieldId: 'custrecord_tko_subsidiaria_diot',
                    value: subsidiaria
                });

                registroDIOT.setValue({
                    fieldId: 'custrecord_tko_estado_diot',
                    value: 10
                })

                registroDIOT.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                }); */

                log.audit({title: 'MR', details: "Se esta ejecutando el MR: getInputData"});

                /** Se obtiene el motor que se esta usando (legacy or suitetax) */
                var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });
                log.audit({title: 'suitetax', details: suitetax});
                
                /* Se realiza la búsqueda de todos los códigos de impuesto */
                var codigosImpuesto = searchCodigoImpuesto(suitetax);

                return codigosImpuesto;

            } catch (error) {
                log.error({ title: 'Error en la busqueda de Códigos de Impuesto', details: error })
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
                log.debug('Estado', "Se esta ejecutando el Map");
                var results = JSON.parse(mapContext.value);
                //log.debug('Resultados de getInput', results);
                /** Se obtiene el motor que se esta usando (legacy or suitetax) */
                // Revisar la carga de registros de los códigos de impuesto
                var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });
                var taxRate, codeName, taxType;

                if(suitetax){
                    /* Registro de cada resultado del map */
                    var taxCodeRecord = record.load({
                        type: record.Type.SALES_TAX_ITEM,
                        id: results.id
                    });
    
                    taxRate = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_RATE });
                    codeName = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_CODE });
                    taxType = taxCodeRecord.getText({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_TYPE });
                }else{
                    /* Registro de cada resultado del map */
                    var taxCodeRecord = record.load({
                        type: record.Type.SALES_TAX_ITEM,
                        id: results.id
                    });
    
                    taxRate = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_RATE });
                    codeName = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_CODE });
                    taxType = taxCodeRecord.getText({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_TYPE });
                }

                var numCodigos = searchCodigoImpuesto(suitetax).runPaged().count;

                /* Ingresar datos necesarios a un arreglo para mandar el valor al reduce */
                //taxRateArray.push(taxRate+"/"+codeName+"/"+taxType);

                taxRateArray.push({
                    taxRate: taxRate,
                    codeName: codeName,
                    taxType: taxType
                })

                /* Se manda el último arreglo al reduce, es decir el que ya contiene todos los datos */
                if(taxRateArray.length == numCodigos){
                    mapContext.write({
                        key: "taxRate",
                        value: JSON.stringify(taxRateArray)
                    });
                }

               /*  var diot = record.submitFields({
                    type: 'customrecord_tko_diot',
                    id: 1,
                    values: {
                        'custrecord_tko_estado_diot': 45
                    }
                }); */
                    

            }catch(error){
                log.error({ title: 'Error al realizar el registro de cada resultado', details: error });
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

            try{
                log.debug('Estado', "Se esta ejecutando el Reduce");
                log.debug('Reduce', reduceContext);
                
                /** Se obtienen los parametros dados por el usuario */
                var objScript = runtime.getCurrentScript();
                var subsidiaria = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY });
                var periodo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD });
                var nombreSub = search.lookupFields({
                    type: search.Type.SUBSIDIARY,
                    id: subsidiaria,
                    columns: ['name']
                });
                var nombrePer = search.lookupFields({
                    type: search.Type.ACCOUNTING_PERIOD,
                    id: periodo,
                    columns: ['periodname']
                });
                var nombreSubsidiaria = nombreSub.name;
                var nombrePeriodo = nombrePer.periodname;

                log.debug('Datos', nombreSubsidiaria + ' ' + nombrePeriodo);

                /** Se obtiene el motor que se esta usando (legacy or suitetax) */
                var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });

                /** Se obtiene si es oneWorld y si no obtiene el nombre de la empresa */
                var oneWorldFeature = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUBSIDIARIES });
                var compname = '';
                if(oneWorldFeature == false){
                    //buscar nombre empresa principal
                     var companyInfo = config.load({
                        type: config.Type.COMPANY_INFORMATION
                    });
                    
                    compname = companyInfo.getValue({
                        fieldId: COMPANY_INFORMATION.FIELDS.ID
                    });
                }
                log.debug('Company', compname);

                /** Se obtienen los valores enviados en el map (códigos de impuesto encontrados en la búsqueda ) */
                var valores = JSON.parse(reduceContext.values[0]);
                //log.debug('Valores', valores);
    
                /** Se realiza la búsqueda de las distintas transacciones */
                var facturasProv = searchVendorBill(subsidiaria, periodo, suitetax);
                var informesGastos = searchExpenseReports(subsidiaria, periodo, suitetax);
                var polizasDiario = searchDailyPolicy(subsidiaria, periodo, suitetax, valores);

                /** Se recorre cada uno de los resultados de las búsquedas de transacciones para ir obteniendo la información del txt */
                /* var proveedoresArray = new Array();
                var proveedores;
                var importeDevoluciones = 0, importe16 = 0, impuestosBienes16 = 0, impuestosBienes10 = 0, importeBienesExentos = 0, importe0 = 0, importeExentos = 0, impuestosRet = 0;
                if(facturasProv.length != 0){
                    for(var i = 0; i < facturasProv.length; i++){
                        var prov = facturasProv[i].proveedor;
                        var tercero = facturasProv[i].tipoTercero;
                        var operacion = facturasProv[i].tipoOperacion;
                        if (tercero == 1){
                            var rfc = facturasProv[i].datos[0].rfc;
                        }else if(tercero == 2){
                            var rfc = facturasProv[i].datos[0].rfc;
                            var taxID = facturasProv[i].datos[0].taxID;
                            var extranjero = facturasProv[i].datos[0].nombreExtranjero;
                            if(extranjero != ""){
                                var pais = facturasProv[i].datos[0].paisResidencia;
                                var nacionalidad = facturasProv[i].datos[0].nacionalidad;
                            }
                        }else{
                            var rfc = "";
                        }
                        var tipoImpuesto = facturasProv[i].tipoImpuesto;
                        var tasa = facturasProv[i].tasa;
                        var importe = facturasProv[i].importe;
                        var impuestos = facturasProv[i].impuestos;
                        // saber si es retencion o iva
                        var tipo = tipoImpuesto.includes('RET');
                        if(tipo == true){
                            //es retencion
                        }else{
                            //es iva
                        }
                        if(credito.length != 0){
                            var importeDevoluciones = importeDevoluciones + facturasProv[i].credito[0].impuesto;
                        }
                        proveedores = prov;
                    }
                } */

                /** Se realiza una búsqueda para ver si ya existe la carpeta de acuerdo al tipo de guardado */
                // Se crea el folder raíz
                var nombreFolder = RECORD_INFO.FOLDER_RECORD.FIELDS.VALUE;
                var folder = searchFolder(nombreFolder);
                var folderId;
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                    log.debug('Info', 'La carpeta ' + folderId + ' existe');
                }else{ // si no existe se crea el folder
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.debug('Info', 'Se creo la carpeta con id ' + folderId);
                }

                /** Parámetros desde las preferencias de la empresa */
                var tipoGuardado = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.TIPO_GUARDADO });
                log.debug('Tipo guardado', tipoGuardado );
                var notificar = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOTIFICAR });
                log.debug('Notificar', notificar);

                // si es oneWorld el tipo de guardado solo será por periodo
                if(oneWorldFeature == false){
                    tipoGuardado = 2;
                }
                // si no se especifico el tipo de guardado, el default será por subsidiarias
                if(tipoGuardado == ''){
                    tipoGuardado = 1;
                }

                //se manda crear el folder dentro de la carpeta raíz
                var subFolderId = createFolder(nombreSubsidiaria, nombrePeriodo, tipoGuardado, folderId);
                log.debug('SubFolder', subFolderId);

                /** Se crea el archivo txt, se indica el folder en el que se va a guardar*/
                var fileObj = file.create({
                    name    : 'test.txt',
                    fileType: file.Type.PLAINTEXT,
                    folder: subFolderId,
                    contents: 'Hello Lily\nHello World'
                });
                var fileId = fileObj.save();
                log.debug('Info txt', 'Id: ' + fileId);
                
                /** Se carga el registro y se pone el archivo para mostrar */
                /* var registroDIOT = record.load({
                    type: 'customrecord_tko_diot',
                    id: 582, 
                });

                registroDIOT.setValue({
                    fieldId: 'custrecord_tko_archivotxt_diot',
                    value: id
                }); */

                /* var diot = record.submitFields({
                    type: 'customrecord_tko_diot',
                    id: 1,
                    values: {
                        'custrecord_tko_archivotxt_diot': id,
                        'custrecord_tko_estado_diot': 90
                    }
                }); */

    
                /** Verifica que las búsquedas no esten vacías */
                if(facturasProv.length == 0 && informesGastos.length == 0 && polizasDiario.length == 0) {
                    log.debug('Busquedas', 'No se encontaron transacciones en ese periodo');
                    // tener en cuenta que aqui se puede mandar ese texto en un key de objeto para manejar error directamente en el pantalla de la DIOT
                } else {
                    log.debug("Facturas", facturasProv);
                    log.debug("Informes", informesGastos);
                    log.debug("Polizas", polizasDiario);
                }
            }catch(error){
                log.error({ title: 'Error en las búsquedas de transacciones', details: error });
            }
        }

        /** Funcion para crear una carpeta */
        function createFolder(nombreSubsidiaria, nombrePeriodo, tipoGuardado, idPadre){
            var nombreFolder = '';
            var folderId;
            var folder;

            if(tipoGuardado == 1) { //guardado por subsidiarias
                nombreFolder = nombreSubsidiaria;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{ 
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }else if(tipoGuardado == 2) { //guardado por periodo
                nombreFolder = nombrePeriodo;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }else { //guardado por subsidiaria y periodo
                nombreFolder = nombreSubsidiaria;
                nombreSubfolder = nombrePeriodo;
                var folderSubId;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe folder subsidiaria
                folder.run().each(function(result){
                    folderSubId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                    return true;
                });
                }else{ //se crea folder subsidiaria
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderSubId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
                log.debug('Folder', folderSubId);
                //se busca el folder periodo dentro del folder subsidiaria
                subfolder = searchFolderInPath(nombreSubfolder, folderSubId);
                if(subfolder.runPaged().count != 0){ //existe
                    subfolder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreSubfolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: folderSubId
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }
            return folderId;
        }

        /**
         * Funcion para ver si una carpeta ya existe
         */
        function searchFolder(nombreFolder){
            var folderSearchObj = search.create({
                type: RECORD_INFO.FOLDER_RECORD.ID,
                filters:
                [
                   [RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,search.Operator.IS,nombreFolder]
                ],
                columns:
                [
                    RECORD_INFO.FOLDER_RECORD.FIELDS.ID,
                    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME
                ]
            });
            return folderSearchObj;
        }

        /**
         * Funcion para ver si la carpeta subsidiaria o periodo ya existe dentro de la carpeta raíz
         */
        function searchFolderInPath(nombreFolder, carpetaRaiz){
            var folderSearchObj = search.create({
                type: RECORD_INFO.FOLDER_RECORD.ID,
                filters:
                [
                   [RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,search.Operator.IS,nombreFolder],
                   "AND",
                   [RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT, search.Operator.IS, carpetaRaiz]
                ],
                columns:
                [
                    RECORD_INFO.FOLDER_RECORD.FIELDS.ID,
                    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME
                ]
            });
            return folderSearchObj;
        }
        
        /**
         * Funcion para buscar las facturas de proveedores
         */
        function searchVendorBill(subsidiaria, periodo, suitetax){
            if (suitetax) {
                // cuando el motor es suite tax
                var facturas = [];
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        ["type","anyof","VendBill"], 
                        "AND", 
                        ["voided","is","F"], 
                        "AND", 
                        ["status","anyof","VendBill:B","VendBill:A"], //,"VendBill:A" para pruebas
                        "AND", 
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"], 
                        "AND", 
                        ["mainline","is","F"], 
                        "AND", 
                        ["vendor.custentity_tko_diot_prov_type","anyof","1","2","3"], 
                        "AND", 
                        ["custbody_tko_tipo_operacion","anyof","1","2","3"]
                    ],
                    columns:
                    [
                        "internalid",
                        "type",
                        search.createColumn({
                            name: "internalid",
                            join: "vendor"
                        }),
                        search.createColumn({
                           name: "custentity_tko_diot_prov_type",
                           join: "vendor"
                        }),
                        "custbody_tko_tipo_operacion",
                        "amount",
                        "netamount",
                        "taxamount",
                        "taxtotal",
                        "total",
                        search.createColumn({
                            name: "taxcode",
                            join: "taxDetail"
                        }),
                        search.createColumn({
                            name: "taxtype",
                            join: "taxDetail"
                        }),
                        search.createColumn({
                           name: "taxrate",
                           join: "taxDetail",
                        })
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'internalid', join: "vendor" });
                    var tipoTercero = result.getValue({ name: 'custentity_tko_diot_prov_type', join: "vendor" });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamount' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getText({ name: 'taxcode', join: 'taxDetail' });
                    var tipoImpuesto = result.getText({ name: 'taxtype', join: 'taxDetail' });
                    var tasa = result.getValue({ name: 'taxrate', join: 'taxDetail' });
                    var errores = '';

                    // Se obtienen los datos del proveedor y se obtienen los errores de los campos que hagan falta
                    var datos = buscaDatos(proveedor, tipoTercero, errores);

                    //Se realiza la búsqueda de creditos de factura de acuerdo al proveedor y id de factura
                    var credito = searchVendorCredit(proveedor, id, suitetax);
                    if (credito.length == 0){
                        credito = "";
                    }
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        tasa: tasa,
                        taxCode: taxCode,
                        tipoImpuesto: tipoImpuesto,
                        credito: credito,
                        datos: datos
                    });

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
                    var iva = 0, errores = '';
    
                    iva = calculaIVA(impuestos,importe,iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
    
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

            if(suitetax){   
                var informes = [];
                var informesSearch = search.create({
                    type: "expensereport",
                    filters:
                    [
                       ["type","anyof","ExpRept"], 
                       "AND", 
                       ["voided","is","F"], 
                       "AND", 
                       ["mainline","is","F"],
                       "AND", 
                       ["status","anyof","ExpRept:I"], 
                       "AND", 
                       ["postingperiod","abs",periodo], 
                       "AND", 
                       ["subsidiary","anyof",subsidiaria], 
                       "AND", 
                       ["taxline","is","F"],
                       "AND", 
                       ["custcol_tko_diot_prov_type","anyof","1","2","3"], 
                       "AND", 
                       ["custbody_tko_tipo_operacion","anyof","1","2","3"]
                    ],
                    columns:
                    [
                       "internalid",
                       "custcol_tkio_proveedor",
                       "custcol_tko_diot_prov_type",
                       "custbody_tko_tipo_operacion",
                       "amount",
                       "netamount",
                       "taxamount",
                       "taxtotal",
                       "total",
                        search.createColumn({
                          name: "taxcode",
                          join: "taxDetail"
                        }),
                        search.createColumn({
                          name: "taxtype",
                          join: "taxDetail"
                        }),
                        search.createColumn({
                           name: "taxrate",
                           join: "taxDetail",
                        })
                    ],
                });

                informesSearch.run().each(function(result){

                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'custcol_tkio_proveedor' });
                    var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamount' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getText({ name: 'taxcode', join: 'taxDetail' });
                    var tipoImpuesto = result.getText({ name: 'taxtype', join: 'taxDetail' });
                    var tasa = result.getValue({ name: 'taxrate', join: 'taxDetail' });
                    var errores = ''; 

                    var datos = buscaDatos(proveedor, tipoTercero, errores);
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        tasa: tasa,
                        taxCode: taxCode,
                        tipoImpuesto: tipoImpuesto,
                        datos: datos
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
                        //falta columna tipo y tasa de impuesto
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
                    //var taxCode = result.getValue({ name: 'taxcode' });
                    var taxCode = result.getText({ name: 'taxcode' });
                    var taxCodeName = result.getValue({ name: 'name', join: 'taxItem' });
                    var iva = 0, errores = '';

                    /* Obtener IVA con la columna no con fórmula */
                    //iva = calculaIVA(impuestos, importe, iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);

                    // errores = datos[0].errores;
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        datos: datos
                    });
    
                    return true;
                });
    
                return informes;
            }
        }

        /**
         * Funcion para buscar las polizas de diario
         */
        function searchDailyPolicy(subsidiaria, periodo, suitetax, valCodigos){

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
                        ["status","anyof","Journal:B"], 
                        "AND", 
                        ["postingperiod","abs",periodo], 
                        "AND", 
                        ["subsidiary","anyof",subsidiaria], 
                        "AND", 
                        ["taxline","is","F"], 
                        "AND", 
                        ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                        "AND", 
                        ["custcol_tko_diot_prov_type","anyof","1","2","3"]
                    ],
                    columns:
                    [
                        "internalid",
                        "custcol_tkio_proveedor",
                        "custcol_tko_diot_prov_type",
                        "custbody_tko_tipo_operacion",
                        "account",
                        "amount",
                        "netamount",
                        "taxtotal",
                        "total",
                        "custcol_tko_diot_importacion"
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'custcol_tkio_proveedor' });
                    var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importacionBienes = result.getValue({ name: 'custcol_tko_diot_importacion' });
                    var cuenta = result.getValue({ name: 'account' });
                    var importe = result.getValue({ name: 'netamount' }); //importe negativo = crédito, importe positivo = débito
                    var impuestos = result.getValue({ name: 'taxtotal' });
                    var errores = '';

                    if(impuestos == ''){
                        impuestos = 0;
                    }

                    // Se manda llamar a la función para la búsqueda de código, tipo y tasa de impuesto
                    var codigos = searchTaxCode(suitetax,cuenta, valCodigos);

                    //Si la cuenta no tiene un código y/o tipo de impuesto asociado, no se toma en cuenta
                    if(codigos.length != 0){
                        var datos = buscaDatos(proveedor, tipoTercero, errores);
        
                        polizas.push({
                            id: id,
                            proveedor: proveedor,
                            tipoTercero: tipoTercero,
                            tipoOperacion: tipoOperacion,
                            importacionBienes: importacionBienes,
                            cuenta: cuenta,
                            importe: importe,
                            impuestos: impuestos,
                            codigos: codigos,
                            datos: datos
                        })
                    }
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
                    var cuenta = result.getValue({ name: 'account' });
                    var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                    var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var importe = result.getValue({ name: 'netamountnotax' });
                    var impuestos = result.getValue({ name: 'taxamount' });
                    var taxCode = result.getValue({ name: 'taxcode' });
                    var taxCodeName = result.getValue({ name: 'name', join: 'taxItem' });
                    var iva = 0, errores = '';
    
                    iva = calculaIVA(impuestos, importe, iva);
                    var datos = buscaDatos(proveedor, tipoTercero, errores);
    
                    var rfc = datos[0].rfc;
                    var taxID = datos[0].taxID;
                    var nombreExtranjero = datos[0].nombreExtranjero;
                    var paisResidencia = datos[0].paisResidencia;
                    var nacionalidad = datos[0].nacionalidad;
                    errores = datos[0].errores;

                    var codigos = searchTaxCode(suitetax, cuenta);
    
                    polizas.push({
                        id: id,
                        proveedor: proveedor,
                        cuenta: cuenta,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        iva: iva,
                        importe: importe,
                        rfc: rfc,
                        taxID: taxID,
                        taxCode: taxCode,
                        taxCodeName: taxCodeName,
                        impuestos: impuestos,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        codigos: codigos,
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
            var taxID = datos.custentity_efx_fe_numregidtrib;
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
                       ["vendor.internalid","anyof",proveedor]
                    //    "AND", 
                    //    ["appliedtotransaction.internalid","anyof",idFactProv] ya no se va a usar
                    ],
                    columns:
                    [
                       "internalid",
                       "entity",
                       "amount",
                       "netamount",
                       "taxamount",
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
                       search.createColumn({
                          name: "taxrate",
                          join: "taxDetail"
                       })
                    ]
                });

                creditSearch.run().each(function(result){

                    var id = result.getValue({ name: 'internalid' });
                    var proveedor = result.getValue({ name: 'entity' });
                    var idFactura = result.getValue({ name: 'internalid', join: 'appliedToTransaction' });
                    var impuesto = result.getValue({ name: 'taxtotal' });
                    var total = result.getValue({ name: 'total' });
                    var taxCode = result.getText({ name: 'taxcode', join: 'taxDetail' });
                    var tipoImpuesto = result.getText({ name: 'taxtype', join: 'taxDetail' });
                    var tasa = result.getValue({ name: 'taxrate', join: 'taxDetail' });
                    total = -1 * (total);
                    var importe = total - impuesto;

                    if(idFactProv == idFactura || idFactProv == idFact){
                        
                        if (proveedor != '' || idFactura != ''){
                            proveedorC = proveedor;
                            idFact = idFactura;
                        }
    
                        if (idFactProv == idFact){
                            if ((idC == id) && (taxCode != '') && (tipoImpuesto != '')){
                            
                                credito.push({
                                    id: id,
                                    proveedor: proveedorC,
                                    idFactura: idFact,
                                    importe: importe,
                                    impuesto: impuesto,
                                    total: total,
                                    taxCode: taxCode,
                                    tipoImpuesto: tipoImpuesto,
                                    tasa: tasa
                                });
                            }
                        }
    
                        idC = id;
                    }

                    
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
         * Función que busca el código y tipo de impuesto para las pólizas
         * @param {*} suitetax Motor (legacy o suitetax)
         * @param {*} cuenta Cuenta de la línea de póliza a comparar con las cuentas asociadas a códigos de impuesto
         * @param {*} valCodigos Registro de los códigos con tipo de impuesto y tasa
         * @returns Codigo y tipo de impuesto
         */
        function searchTaxCode(suitetax, cuenta, valCodigos){
            if(suitetax){
                var codigos = [];
                var codigoSearch = search.create({
                    type: "salestaxitem",
                    filters:
                    [
                       ["country","anyof","MX"]
                    ],
                    columns:
                    [
                       "internalid",
                       "name",
                       "description",
                       "taxtype",
                       search.createColumn({
                          name: "name",
                          join: "taxType"
                       }),
                       search.createColumn({
                          name: "receivablesaccount",
                          join: "taxType"
                       }),
                       search.createColumn({
                          name: "payablesaccount",
                          join: "taxType"
                       })
                    ]
                 });
                codigoSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var taxCode = result.getValue({ name: 'name' });
                    var tipoImpuesto = result.getValue({ name: 'name', join:'taxType' });
                    var cuenta1 = result.getValue({ name: 'receivablesaccount', join:'taxType' });
                    var cuenta2 = result.getValue({ name: 'payablesaccount', join:'taxType' });
                    var tasa;

                    /** Se realiza un recorrido en el arreglo de valores y se ve si el id coincide con el código de impuesto para obtener los datos*/
                    for(var i = 0; i < valCodigos.length; i++){
                        if(valCodigos[i].codeName == taxCode){
                            tasa = valCodigos[i].taxRate;
                        }
                    }

                    /** Si la cuenta coincide con una de las asociadas con un código de impuestos */
                    if (cuenta == cuenta1 || cuenta == cuenta2){
                        codigos.push({
                            id: id,
                            taxCode: taxCode,
                            tipoImpuesto: tipoImpuesto,
                            tasa: tasa
                        });
                    }

                    return true;
                });
                return codigos;
            }else{
                var codigos = [];
                var codigoSearch = search.create({
                    type: "salestaxitem",
                    filters:
                    [
                       ["country","anyof","MX"]
                    ],
                    columns:
                    [
                       "internalid",
                       "name",
                       "rate",
                       "taxtype",
                       "purchaseaccount",
                       "saleaccount"
                    ]
                 });
                codigoSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var taxCode = result.getValue({ name: 'name' });
                    var iva = result.getValue({ name: 'rate' });
                    var tipoImpuesto = result.getValue({ name: 'taxtype' });
                    var cuenta1 = result.getValue({ name: 'purchaseaccount' });
                    var cuenta2 = result.getValue({ name: 'saleaccount' });

                    if(cuenta == cuenta1 || cuenta == cuenta2){
                        codigos.push({
                            id: id,
                            taxCode: taxCode,
                            tipoImpuesto: tipoImpuesto,
                            iva: iva,
                        });
                    }

                    return true;
                });
                
                return codigos;
            }
        }

        /**
         * Función que busca los códigos de impuesto
         * @param {*} suitetax Motor (legacy o suitetax)
         * @returns Búsqueda con todas las columnas
         */
        function searchCodigoImpuesto(suitetax){
            if(suitetax){
                var codigoSearch = search.create({
                    type: "salestaxitem",
                    filters:
                    [
                       ["country","anyof","MX"]
                    ],
                    columns:
                    [
                       "internalid",
                       "name",
                       search.createColumn({
                          name: "name",
                          join: "taxType"
                       }),
                       search.createColumn({
                          name: "receivablesaccount",
                          join: "taxType"
                       }),
                       search.createColumn({
                          name: "payablesaccount",
                          join: "taxType"
                       })
                    ]
                });
                return codigoSearch;
            }else{
                var codigoSearch = search.create({
                    type: "salestaxitem",
                    filters:
                    [
                       ["country","anyof","MX"]
                    ],
                    columns:
                    [
                       "internalid",
                       "name",
                       "rate",
                       "taxtype",
                       "purchaseaccount",
                       "saleaccount"
                    ]
                });
                return codigoSearch;
            }
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

            /* var diot = record.submitFields({
                type: 'customrecord_tko_diot',
                id: 1,
                values: {
                    'custrecord_tko_estado_diot': 97
                }
            }); */

        }


        return {getInputData, map, reduce, summarize};

    });
