define('app-main', function(require)
{
    // Dependencies.
    // Requires jQuery.
    var oHelpers                     = require('helpers/helpers-web'),
        Socket                       = require('helpers/socket'),
        oUIDispatch                  = require('helpers/ui-dispatch'),
        Dropdown                     = require('helpers/dropdown')
        MenuKeyNav                   = require('helpers/menu-key-nav'),
        fnPopupWindow                = require('helpers/popup-window'),
        oModes                       = require('edit-control/modes');
        oHtmlPreviewFrameConnector   = require('html-preview-frame-connector');
                                       require('lib/tooltip');
    
    // UI Handler Dependencies.    
    var oChatUIHandler               = require('chat'),
        oHtmlTemplateInsertUIHandler = require('html-template-dialog'),
        oEditor                      = require('editor'),
        oKeyShortcutHandler          = require('helpers/key-shortcut-handler');
        
    // Other module globals.
    var _sUNTITLED     = 'Untitled';
    var oSocket        = null;
    var oUserInfo      = null;

    var oTitleUIHandler = (
    {   
        onEvent: function(oEvent)
        {            
            // Set title on ENTER / Click.
            var sEventType = oEvent.type;
            var jTarget = $(oEvent.target);
            if ((sEventType == 'keydown' && oEvent.which == 13       ) || 
                (sEventType == 'click'   && jTarget.is('#title-save')))
            {
                this._setTitleToLocal();
                oEvent.preventDefault();
            }
        },
        
        disable: function()
        {
            $('#title-input, #title-save').prop('disabled', true);
            $('#title .hidden-focusable a').attr('tabIndex', -1);            
        },
        
        setTitle: function(sTitle, bDoNotSetWithHistory)
        {
            $('#toolbar-item-title .toolbar-item-selection').text(sTitle);
            $('#title-input').val(sTitle);
            $('#toolbar-item-title .toolbar-item-btn').attr('title', sTitle);
            if (bDoNotSetWithHistory)
                document.title = sTitle;
            else
                oHelpers.setTitleWithHistory(sTitle);
            oDownloadUIHandler.updateName();
        },
        
        getTitle: function()
        {
            return $('#title-input').val();
        },
        
        _setTitleToLocal: function()
        {
            var sTitle = $('#title-input').val();
            oSocket.send('setDocumentTitle', { 'sTitle': sTitle });
            this.setTitle(sTitle);
            oUIDispatch.blurFocusedUIHandler();
            
            // Set HTML title.
            if (oModeUIHandler.getMode().getName() == 'html')
                oEditor.replaceRegex(/<title>.*<\/title>/, '<title>' + sTitle + '</title>');
        }
    });
    
    var oModeUIHandler = (
    {
        _oModeMenu:    null,
        _oCurrentMode: null,
        
        init: function()
        {
            this._oModeMenu = oModes.createModeMenu('#mode-menu', 'Set Language', this, this._setModeToLocal);
        },
        
        onEvent: function(oEvent)
        {
            this._oModeMenu.onEvent(oEvent);
        },
        
        disable: function()
        {
            $('.menu').addClass('disabled');
        },
        
        setMode: function(oMode, bSetByMenu)
        {
            $('#toolbar-item-mode .toolbar-item-selection').text(oMode.getDisplayName());
            $('BODY').toggleClass('mode-html',       oMode.getName() == 'html');
            $('BODY').toggleClass('show-html-tools', oMode.getName() == 'html');
            if (oMode.getName() == 'html')
                oHtmlPreviewDockDropdownUIHandler.showPreview();
            else
                oHtmlPreviewDockDropdownUIHandler.setPreviewDock('None');
            this._oCurrentMode = oMode;
            oEditor.setMode(oMode);
            oDownloadUIHandler.updateName();
            if (!bSetByMenu)
                this._oModeMenu.setSelected(oMode, true);
        },
        
        getMode: function()
        {
            return this._oCurrentMode;
        },
        
        _setModeToLocal: function(oMode)
        {
            this.setMode(oMode, true);
            oSocket.send('setMode', { sMode: oMode.getName() });
            oUIDispatch.blurFocusedUIHandler();
        }
    });
    
    var oDownloadUIHandler = (
    {
        _jFrame: null,
        
        onEvent: function(oEvent)
        {
            // Download on ENTER / Click.
            var sEventType = oEvent.type;
            var jTarget = $(oEvent.target);
            if ((sEventType == 'keydown' && oEvent.which == 13       ) || 
                (sEventType == 'click'   && jTarget.is('button#download')))
            {
                this._download();
                oEvent.preventDefault();
            }
        },
        
        updateName: function()
        {
            var sTitle = oTitleUIHandler.getTitle();
            var oMode = oModeUIHandler.getMode();
            var sExtension = (oMode ? oMode.getDefaultExtension() : '');
            if (sTitle && sExtension)
            {
                if (sTitle.indexOf('.') == -1)
                    $('#download-as').val(sTitle + '.' + sExtension);
                else
                    $('#download-as').val(sTitle);
            }
        },
        
        _download: function()
        {
            // Construct download URL.
            var sHref = window.location.href;
            if (sHref[-1] != '/')
                sHref += '/'
            var sUrl = sHref + 'download?filename=' + encodeURIComponent($('#download-as').val());
            
            // Update download iFrame.
            if (!this._jFrame)
                this._jFrame = $('<iframe>').hide().appendTo('body');
            this._jFrame.attr('src', sUrl);
            
            // Blur.
            oUIDispatch.blurFocusedUIHandler();
        }
    });
    
    var oLinksUIHandler = (
    {
        onEvent: function(oEvent)
        {
            if (oEvent.type == 'click' && $(oEvent.target).is('#snapshot-button'))
                oSocket.send('snapshotDocument');
        },
        
        addSnapshot: function(oSnapshot)
        {
            $('#snapshots #placeholder').remove();
            var sUrl = oHelpers.getOrigin() + '/v/' + oSnapshot.sID;
            var sDate = oHelpers.formatDateTime(oSnapshot.oDateCreated);
            var jSnapshot = $('<a class="snapshot-link"><span class="date"></span><span class="url"></span></a>');
            jSnapshot.find('span.date').text(sDate);
            jSnapshot.find('span.url').text(sUrl);
            jSnapshot.attr('href', sUrl).appendTo('#snapshots');
        },
    });

    var oHtmlPreviewDockDropdownUIHandler = (
    {
        _oMenu: null,
        _jPreview: $('#html-preview-wrap'),
        
        init: function()
        {
            this._oMenu = new MenuKeyNav('#html-preview-dock-menu', this, this.setPreviewDock);
        },
        
        showPreview: function()
        {
            if($(window).width() > $(window).height())
                this._oMenu.setSelected('Right');
            else
                this._oMenu.setSelected('Bottom');
        },
        
        onEvent: function(oEvent)
        {
            this._oMenu.onEvent(oEvent);
        },
        
        setPreviewDock: function(sDockDir)
        {
            // Update Menu.
            $('#toolbar-item-html-preview-dock .toolbar-item-value').text(sDockDir);
            
            // Show Preview.
            sDockDir = sDockDir.toLowerCase();
            $('#html-preview-wrap').attr('class', sDockDir);
            oHtmlPreviewDockSplitUIHandler.updateSplit(sDockDir);
            oEditor.resize();
            
            // Pause or play Preview.
            if (sDockDir == 'none')
            {
                oHtmlPreviewFrameConnector.sendMessage('pause');
            }
            else
            {
                oHtmlPreviewFrameConnector.sendMessage('play',
                {
                    aLines: oEditor.getAllLines()
                });
            }
                
            // Close menu.
            oUIDispatch.blurFocusedUIHandler();
        }
    });

    var oHtmlPreviewDockSplitUIHandler = (
    {
        _sDockDir: '',
        _iPctSplitRight:  40,
        _iPctSplitBottom: 40,
        _jEditor: $('#edit'),
        _jPreview: $('#html-preview-wrap'),
        _jEditWrap: $('#edit-wrap'),
        _jSplitElem: $('#html-preview-border'),
        _bIsDragging: false,
        
        contains: function(jElem)
        {
            return !!jElem.closest(this._jSplitElem).length;
        },
        
        onEvent: function(oEvent)
        {
            switch(oEvent.type)
            {
                case 'mousedown':
                    this._setIsDragging(true);
                    break
                
                case 'mouseup':
                    oUIDispatch.blurFocusedUIHandler();
                    break;
                
                case 'mousemove':
                    if (this._bIsDragging)
                    {
                        var oWrapOffset = $('#edit-wrap').offset();
                        switch(this._sDockDir)
                        {
                            case 'right':
                                var iEditWrapWidth    = this._jEditWrap.width();
                                var iMouseOffsetLeft  = oEvent.pageX - oWrapOffset.left;
                                this._iPctSplitRight  = (iEditWrapWidth - iMouseOffsetLeft) / iEditWrapWidth * 100;
                                this._iPctSplitRight = Math.min(Math.max(this._iPctSplitRight, 10), 90);
                                break;
                            
                            case 'bottom':
                                var iEditWrapHeight   = this._jEditWrap.height();
                                var iMouseOffsetTop   = oEvent.pageY - oWrapOffset.top;
                                this._iPctSplitBottom = (iEditWrapHeight - iMouseOffsetTop) / iEditWrapHeight * 100;
                                this._iPctSplitBottom = Math.min(Math.max(this._iPctSplitBottom, 10), 90);
                                break;
                        }
                        this.updateSplit();
                    }
                    break;
            }
        },
        
        onFocusOut: function()
        {
            this._setIsDragging(false);
        },
        
        _setIsDragging: function(bIsDragging)
        {
            if (bIsDragging)
            {
                this._bIsDragging = true;
                this._jSplitElem.find('input').focus();
                
                // Work around Chrome bug where mousemove events don't fire over an iframe.
                // Also forces the cursor to stay a resize cursor.
                $('#resize-overlay').show().css('cursor', this._sDockDir == 'right' ? 'ew-resize' : 'ns-resize');
            }
            else
            {
                this._bIsDragging = false;
                $('BODY').css('cursor', 'auto');
                $('#resize-overlay').hide().css('cursor', 'auto');
                oEditor.resize();
            }
        },
        
        updateSplit: function(sDockDir)
        {
            // Optionally set dock dir.
            if (sDockDir)
                this._sDockDir = sDockDir;
                
            // Refresh split.
            switch(this._sDockDir)
            {
                case 'right':
                    this._jPreview.width(this._iPctSplitRight + '%').height('');
                    this._jEditor.width(100 - this._iPctSplitRight + '%').height('');
                    break;
                
                case 'bottom':
                    this._jPreview.height(this._iPctSplitBottom + '%').width('');
                    this._jEditor.height(100 - this._iPctSplitBottom + '%').width('');
                    break;
                
                case 'none':
                    this._jPreview.height('').width('');
                    this._jEditor.height('').width('');
                    break;
            }
        }
    });

    var oHtmlPreviewRefreshFrequencyUIHandler = (
    {
        _oMenu: null,
        
        init: function()
        {
            this._oMenu = new MenuKeyNav('#html-preview-refresh-menu', this, this._setRefreshFrequency);
        },
        
        onEvent: function(oEvent)
        {
            this._oMenu.onEvent(oEvent);
        },
        
        setAutoRefresh:function(bAutoRefresh, bSetByMenu)
        {
            var sID = (bAutoRefresh ? 'Auto' : 'Manual');
            $('#toolbar-item-html-preview-refresh-frequency .toolbar-item-value').text(sID);            
            oHtmlPreviewRefreshUIHandler.setDisabled(bAutoRefresh);
            if (!bSetByMenu)
                this._oMenu.setSelected(sID, true);
        },
        
        _setRefreshFrequency: function(sRefreshFrequency)
        {
            // Validate.
            oHelpers.assert(oHelpers.inArray(sRefreshFrequency, ['Auto', 'Manual']));
            
            // Update UI.
            this.setAutoRefresh(sRefreshFrequency == 'Auto', true);
            oUIDispatch.blurFocusedUIHandler();
            
            // Send action.
            oSocket.send('setAutoRefreshPreview',
            {
                bAutoRefreshPreview: sRefreshFrequency == 'Auto'
            });
        }
    });
    
    var oHtmlPreviewPopupUIHandler = (
    {
        contains: function(jElem)
        {
            return !!jElem.closest('#toolbar-item-html-preview-popup').length;
        },
        
        onEvent: function(oEvent)
        {
            // Set title on ENTER / Click.
            var sEventType = oEvent.type;
            if ((sEventType == 'keydown' && oEvent.which == 13) || sEventType == 'click')
            {
                this._popupPreview();
                oEvent.preventDefault();
            }
        },
        
        _popupPreview: function()
        {
            fnPopupWindow(oHelpers.joinURL(window.location.href, 'preview'), 600, 500);
            oHtmlPreviewDockDropdownUIHandler.setPreviewDock('None');
            oUIDispatch.blurFocusedUIHandler();
        }
    });

    var oHtmlPreviewRefreshUIHandler = (
    {
        _jElem: $('#toolbar-item-html-preview-refresh'),
        
        contains: function(jElem)
        {
            return !!jElem.closest(this._jElem).length;
        },
        
        setDisabled: function(bDisabled)
        {
            this._jElem.toggleClass('disabled', bDisabled);
        },
        
        onEvent: function(oEvent)
        {
            // Set title on ENTER / Click.
            var sEventType = oEvent.type;
            if ((sEventType == 'keydown' && oEvent.which == 13) || sEventType == 'click')
            {
                if (!this._jElem.hasClass('disabled'))
                    this._refreshPreview();
                oEvent.preventDefault();
            }
        },
        
        _refreshPreview: function()
        {
            oUIDispatch.blurFocusedUIHandler();
            oSocket.send('refreshPreview');
        }
    });
    
    var oToggleHtmlToolsUIHanlder = (
    {
        contains: function(jElem)
        {
            return !!jElem.closest('#html-tools-btn').length;
        },
        
        onEvent: function(oEvent)
        {
            // Set title on ENTER / Click.
            var sEventType = oEvent.type;
            if ((sEventType == 'keydown' && oEvent.which == 13) || sEventType == 'click')
            {
                $('BODY').toggleClass('show-html-tools');
                oUIDispatch.blurFocusedUIHandler();
                oEvent.preventDefault();
            }
        }
    });
    
    function handleServerAction(oAction)
    {
        switch(oAction.sType)
        {
            case 'connect':
                oUserInfo = oAction.oData;
                break;
                
            case 'setDocumentTitle':
                oTitleUIHandler.setTitle(oAction.oData.sTitle);
                break;
                
            case 'setMode':
                var oMode = oModes.oModesByName[oAction.oData.sMode];
                oModeUIHandler.setMode(oMode);
                break;
                                
            case 'setDocumentID': // Fired after creating a new document.
                
                // Push the new URL.
                // HACK: In order for the first history entry to have a title of "codr.io"
                //       and the second to have a title of "Untitled", we set
                //       the title back to "codr.io" right before pushing the new state.                    
                if (oHelpers.isFF())
                {
                    oHelpers.setTitleWithHistory('codr.io');
                    window.setTimeout(oHelpers.createCallback(this, function()
                    {
                        window.history.pushState(   null, '', '/' + oAction.oData.sDocumentID);
                        document.title = _sUNTITLED;
                    }), 0);                        
                }
                else
                {
                    window.history.pushState(   null, '', '/' + oAction.oData.sDocumentID);
                    oHelpers.setTitleWithHistory(_sUNTITLED);
                }
                
                updateCollabUrl(oAction.oData.sDocumentID);
                break;
                
            case 'addSnapshot':
                oLinksUIHandler.addSnapshot(oAction.oData);
                break;
                
            case 'error':
                document.write(oAction.oData.sMessage);
                break;
            
            case 'setAutoRefreshPreview':
                oHtmlPreviewRefreshFrequencyUIHandler.setAutoRefresh(oAction.oData.bAutoRefreshPreview);
                break;
                
                return false;
        }
        return true;
    }
    
    function updateCollabUrl(sDocumentID)
    {
        oHelpers.assert(oHelpers.inString(sDocumentID, document.location.href), 'Bad URL');
        $('#collaborate-url').val('http://' + document.location.href.slice(7));
        $('#clone-doc-id').val(sDocumentID);
    }
        
    return function(bIsNewDocument, bIsSnapshot, oNewDocumentMode)
    {
        // Init Socket.
        var sSocketURL = (bIsSnapshot ? null : 'ws://' + window.document.location.host + '/');
        oSocket = new Socket(sSocketURL);
        oSocket.bind('message', null, handleServerAction);
        
        // Init UI Handlers.
        oEditor.init(oSocket);
        oChatUIHandler.init(oSocket, function(){ return oUserInfo });
        oHtmlTemplateInsertUIHandler.init(oEditor, oTitleUIHandler);
        oModeUIHandler.init();
        oHtmlPreviewDockDropdownUIHandler.init();
        oHtmlPreviewRefreshFrequencyUIHandler.init();
        oKeyShortcutHandler.init();
        
        // Init HTML preview connector.
        oHtmlPreviewFrameConnector.init();
        oSocket.bind('message', this, function(oAction)
        {
            oHtmlPreviewFrameConnector.sendMessage('serverMessage', oAction);
        }, true /* bHandleMsgSends */);
        
        // Set initial DOM focus to editor.
        oEditor.focus();
                
        // Development Hack: Expose the editor.
        window._editor = oEditor;

        if (bIsSnapshot)
        {
            // Disable controls.
            // Chat and Links are disabled in index.html to avoid delay.
            oTitleUIHandler.disable();
            oModeUIHandler.disable();
            
            // Set Ccontent.
            var sDocumentID = /^\/v\/([a-z0-9]+)\/?$/.exec(document.location.pathname)[1];
            $.get('/ajax/' + sDocumentID + '/', oHelpers.createCallback(this, function(oResponse)
            {
                oHelpers.assert(!oResponse.sError, oResponse.sError);
                oEditor.setContent(oResponse.aLines);
                oModeUIHandler.setMode(oModes.oModesByName[oResponse.sMode]);
                oTitleUIHandler.setTitle(oResponse.sTitle);
            }));
            updateCollabUrl(sDocumentID);
        }
        else
        {
            // On a new document creation, default the title to "Untitled".
            if (bIsNewDocument)
            {
                oTitleUIHandler.setTitle(_sUNTITLED, true);
                oModeUIHandler.setMode(oNewDocumentMode);
                
                oSocket.send('createDocument',
                {
                    sMode:  oNewDocumentMode.getName(),
                    sTitle: _sUNTITLED
                });
            }
            else // Open existing document.
            {
                var sDocumentID = /^(\/v)?\/([a-z0-9]+)\/?$/.exec(document.location.pathname)[2];
                oSocket.send('openDocument',
                {
                    sDocumentID: sDocumentID,
                    bIsPreview: false
                });            
                updateCollabUrl(sDocumentID);
            }
        }
        
        // Init tooltips.
        $('#auto-insert-help').tooltip(
        {
            html: true,
            title: "<div style=\"padding: 5px;\">\
                        Automatically insert this <br/>\
                        template into  new HTML<br/>\
                        documents you create?</div>"
        });
        
        // Register dropdowns.
        new Dropdown('#toolbar-item-mode',                           oModeUIHandler);
        new Dropdown('#toolbar-item-title',                          oTitleUIHandler);
        new Dropdown('#toolbar-item-download',                       oDownloadUIHandler);
        new Dropdown('#toolbar-item-link',                           oLinksUIHandler);
        new Dropdown('#toolbar-item-chat',                           oChatUIHandler);
        new Dropdown('#toolbar-item-html-template-insert',           oHtmlTemplateInsertUIHandler);
        new Dropdown('#toolbar-item-html-preview-dock',              oHtmlPreviewDockDropdownUIHandler);
        new Dropdown('#toolbar-item-html-preview-refresh-frequency', oHtmlPreviewRefreshFrequencyUIHandler);
        new Dropdown('#toolbar-item-fork');
        
        // Register other UI handlers.
        oUIDispatch.registerUIHandler(oHtmlPreviewPopupUIHandler);
        oUIDispatch.registerUIHandler(oHtmlPreviewRefreshUIHandler);
        oUIDispatch.registerUIHandler(oToggleHtmlToolsUIHanlder);
        oUIDispatch.registerUIHandler(oHtmlPreviewDockSplitUIHandler);
        
        // Bind shorctut handlers.
        oKeyShortcutHandler.registerShortcut('T', $('#toolbar-item-title'),     -15);
        oKeyShortcutHandler.registerShortcut('L', $('#toolbar-item-mode'),      -15);
        oKeyShortcutHandler.registerShortcut('D', $('#toolbar-item-download'),  12);
        oKeyShortcutHandler.registerShortcut('F', $('#toolbar-item-fork'),      12);
        if (!bIsSnapshot)
        {
            oKeyShortcutHandler.registerShortcut('C', $('#toolbar-item-chat'),  12);
            oKeyShortcutHandler.registerShortcut('K', $('#toolbar-item-link'),  12);
        }
        oKeyShortcutHandler.registerShortcut('I', $('#toolbar-item-html-template-insert'),           -2, 18);
        oKeyShortcutHandler.registerShortcut('O', $('#toolbar-item-html-preview-dock'),              -2, 18);
        oKeyShortcutHandler.registerShortcut('P', $('#toolbar-item-html-preview-popup'),             -2, 18);
        oKeyShortcutHandler.registerShortcut('A', $('#toolbar-item-html-preview-refresh-frequency'), -2, 18);
        oKeyShortcutHandler.registerShortcut('R', $('#toolbar-item-html-preview-refresh'),           -2, 18);
        oKeyShortcutHandler.registerShortcut('H', $('#html-tools-btn'),                              15);
        
        // Disable native browser handling for saving/searching.
        // TODO: Think through keyboard controls for a mac.
        oHelpers.on(window, 'keydown', null, function(oEvent)
        {
            if (oEvent.ctrlKey && oHelpers.inArray(oEvent.which, [83, 70, 71]))
            {
                oEvent.preventDefault();
            }
        });
    };
});
