require 'webrick'

srv = WEBrick::HTTPServer.new({:DocumentRoot => '.',
                               :BindAddress => '127.0.0.1',
                               :Port => 8080})

srv_shutdown = Proc.new do
    srv.shutdown()
end

Signal.trap(:INT, srv_shutdown)
Signal.trap(:TERM, srv_shutdown)

srv.start()
